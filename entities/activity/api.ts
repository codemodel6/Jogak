import type { ActivityItem, MyActivity } from "@/entities/activity";
import { supabase } from "@/shared/supabase";
import { getProfileMap, requireUser } from "@/shared/lib/supabase/helpers";

type MatchRow = {
  id: string;
  chat_id: string;
  requester_id: string;
  receiver_id: string;
  status: string;
  requested_at: string;
  matched_at: string | null;
  ended_at: string | null;
};

type ChatRow = {
  id: string;
  user1_id: string | null;
  user2_id: string | null;
  created_at: string;
};

type ReviewRow = {
  id: string;
  reviewer_id: string;
  rating: number;
  content: string;
  created_at: string;
};

const ITEM_LIMIT = 30;

function maskName(name: string) {
  if (name.length <= 1) return name;
  if (name.length === 2) return `${name[0]}*`;
  return `${name[0]}${"*".repeat(name.length - 2)}${name.at(-1)}`;
}

function isThisMonth(value: string | null, now: Date) {
  if (!value) return false;
  const date = new Date(value);
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

// 내 활동: 매칭(matches)·대화(chats/messages)·받은 후기(reviews)를 모아 집계한다.
export async function getMyActivity(): Promise<MyActivity> {
  const user = await requireUser();

  const [matchesResult, chatsResult, reviewsResult] = await Promise.all([
    supabase
      .from("matches")
      .select("id, chat_id, requester_id, receiver_id, status, requested_at, matched_at, ended_at")
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("requested_at", { ascending: false }),
    supabase
      .from("chats")
      .select("id, user1_id, user2_id, created_at")
      .eq("is_group", false)
      .order("created_at", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, reviewer_id, rating, content, created_at")
      .eq("reviewee_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (matchesResult.error) throw matchesResult.error;
  if (chatsResult.error) throw chatsResult.error;
  if (reviewsResult.error) throw reviewsResult.error;

  const matches = (matchesResult.data ?? []) as MatchRow[];
  const chats = (chatsResult.data ?? []) as ChatRow[];
  const reviews = (reviewsResult.data ?? []) as ReviewRow[];

  // 받은 대화 요청(상대가 연 1:1 방)에 내가 처음 답장한 시각
  const receivedChats = chats.filter((chat) => chat.user2_id === user.id && chat.user1_id);
  const firstReplyAt = new Map<string, string>();
  if (receivedChats.length > 0) {
    const { data, error } = await supabase
      .from("messages")
      .select("chat_id, created_at")
      .in("chat_id", receivedChats.map((chat) => chat.id))
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    for (const row of (data ?? []) as Array<{ chat_id: string; created_at: string }>) {
      if (!firstReplyAt.has(row.chat_id)) firstReplyAt.set(row.chat_id, row.created_at);
    }
  }
  const answered = receivedChats.filter((chat) => firstReplyAt.has(chat.id));
  const responseMinutes = answered.map(
    (chat) => (new Date(firstReplyAt.get(chat.id)!).getTime() - new Date(chat.created_at).getTime()) / 60000,
  );

  const partnerIds = [
    ...matches.map((match) => (match.requester_id === user.id ? match.receiver_id : match.requester_id)),
    ...chats.map((chat) => (chat.user1_id === user.id ? chat.user2_id : chat.user1_id)),
    ...reviews.map((review) => review.reviewer_id),
  ].filter((id): id is string => Boolean(id));
  const profiles = await getProfileMap([...new Set(partnerIds)]);
  const nameOf = (id: string | null) => (id && profiles.get(id)?.name) || "상대";

  const now = new Date();
  const met = matches.filter((match) => match.status === "met");
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const count = met.filter((match) => {
      if (!match.ended_at) return false;
      const ended = new Date(match.ended_at);
      return ended.getFullYear() === date.getFullYear() && ended.getMonth() === date.getMonth();
    }).length;
    return { month: `${date.getMonth() + 1}월`, count };
  });

  const items: ActivityItem[] = [];
  for (const match of matches) {
    const partner = nameOf(match.requester_id === user.id ? match.receiver_id : match.requester_id);
    const href = `/chat/${match.chat_id}`;
    items.push({
      id: `match-request-${match.id}`,
      type: "매칭",
      title: `${partner}님과의 매칭`,
      description: match.requester_id === user.id ? "매칭을 요청했어요." : "매칭 요청을 받았어요.",
      at: match.requested_at,
      href,
    });
    if (match.matched_at) {
      items.push({ id: `match-matched-${match.id}`, type: "매칭", title: `${partner}님과의 매칭`, description: "매칭이 성사됐어요.", at: match.matched_at, href });
    }
    if (match.status === "met" && match.ended_at) {
      items.push({ id: `match-met-${match.id}`, type: "매칭", title: `${partner}님과의 매칭`, description: "만남 성공으로 기록됐어요.", at: match.ended_at, href });
    }
  }
  for (const chat of chats) {
    const iOpened = chat.user1_id === user.id;
    items.push({
      id: `chat-${chat.id}`,
      type: "대화",
      title: `${nameOf(iOpened ? chat.user2_id : chat.user1_id)}님과의 대화`,
      description: iOpened ? "대화를 요청했어요." : "대화 요청을 받았어요.",
      at: chat.created_at,
      href: `/chat/${chat.id}`,
    });
  }
  for (const review of reviews) {
    items.push({
      id: `review-${review.id}`,
      type: "후기",
      title: `${maskName(nameOf(review.reviewer_id))}님이 후기를 남겼어요`,
      description: `★${review.rating}${review.content ? ` · ${review.content}` : ""}`,
      at: review.created_at,
      href: "/reviews?tab=received",
    });
  }
  items.sort((a, b) => b.at.localeCompare(a.at));

  return {
    metCount: met.length,
    metThisMonth: met.filter((match) => isThisMonth(match.ended_at, now)).length,
    reviewCount: reviews.length,
    reviewThisMonth: reviews.filter((review) => isThisMonth(review.created_at, now)).length,
    averageRating: reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null,
    responseRate: receivedChats.length ? Math.round((answered.length / receivedChats.length) * 100) : null,
    receivedRequests: receivedChats.length,
    answeredRequests: answered.length,
    averageResponseMinutes: responseMinutes.length
      ? Math.round(responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length)
      : null,
    monthly,
    items: items.slice(0, ITEM_LIMIT),
  };
}
