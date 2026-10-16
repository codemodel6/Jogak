import type { ChatMember } from "@/entities/chat";
import { supabase } from "@/shared/supabase";
import { getProfileMap, getProfileRow, requireUser } from "@/shared/lib/supabase/helpers";

type ChatRow = {
  id: string;
  user1_id: string | null;
  user2_id: string | null;
  is_group?: boolean | null;
  title?: string | null;
  match_requester?: string | null;
  match_status?: string | null;
  meet_success_user1?: boolean | null;
  meet_success_user2?: boolean | null;
  post_id?: string | null;
  is_priority?: boolean | null;
  created_at?: string | null;
  closed_at?: string | null;
  closed_reason?: string | null;
};

type ChatMemberRow = {
  chat_id: string;
  user_id: string;
  role: "owner" | "member";
  last_read_at: string | null;
};

// 채팅방 목록은 권한(RLS)에 의해 내가 참여한 방만 내려온다.
async function getMembers(chatIds: string[]) {
  if (chatIds.length === 0) {
    return [] as ChatMemberRow[];
  }

  const { data, error } = await supabase
    .from("chat_members")
    .select("chat_id, user_id, role, last_read_at")
    .in("chat_id", chatIds)
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ChatMemberRow[];
}

function buildGroupTitle(chat: ChatRow, memberNames: string[]) {
  if (chat.title) {
    return chat.title;
  }

  const shown = memberNames.slice(0, 3).join(", ");
  return memberNames.length > 3 ? `${shown} 외 ${memberNames.length - 3}명` : shown || "단체 채팅";
}

// 방마다 가장 최근 메시지 1개
async function getLastMessages(chatIds: string[]) {
  const result = new Map<string, { message: string; timestamp: string }>();
  if (chatIds.length === 0) {
    return result;
  }

  const { data, error } = await supabase
    .from("messages")
    .select("chat_id, message, kind, created_at")
    .in("chat_id", chatIds)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw error;
  }

  for (const row of (data ?? []) as Array<{ chat_id: string; message: string; kind: string | null; created_at: string }>) {
    if (!result.has(row.chat_id)) {
      const message = row.kind === "system" ? "매치가 취소되었습니다." : row.message;
      result.set(row.chat_id, { message, timestamp: row.created_at });
    }
  }

  return result;
}

async function getPostTitles(postIds: string[]) {
  const result = new Map<string, string>();
  if (postIds.length === 0) {
    return result;
  }

  const { data, error } = await supabase.from("posts").select("id, title").in("id", postIds);
  if (error) {
    throw error;
  }
  for (const row of (data ?? []) as Array<{ id: string; title: string }>) {
    result.set(row.id, row.title);
  }
  return result;
}

export async function getChats() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as ChatRow[];
  const members = await getMembers(rows.map((chat) => chat.id));
  const lastMessages = await getLastMessages(rows.map((chat) => chat.id));
  const profiles = await getProfileMap([...new Set(members.map((member) => member.user_id))]);
  const postTitles = await getPostTitles([...new Set(rows.map((chat) => chat.post_id).filter((id): id is string => Boolean(id)))]);

  const chats = rows.map((chat) => {
    const others = members.filter((member) => member.chat_id === chat.id && member.user_id !== user.id);
    const otherNames = others.map((member) => profiles.get(member.user_id)?.name ?? "익명");
    const firstOther = others[0] ? profiles.get(others[0].user_id) : undefined;
    const isGroup = Boolean(chat.is_group);

    return {
      chatId: chat.id,
      matchStatus: chat.match_status ?? "none",
      isGroup,
      title: isGroup ? buildGroupTitle(chat, otherNames) : (otherNames[0] ?? "익명"),
      memberCount: others.length + 1,
      otherUser: {
        name: otherNames[0] ?? "익명",
        photos: firstOther?.photos ?? [],
      },
      lastMessage: lastMessages.get(chat.id) ?? null,
      postId: chat.post_id ?? null,
      postTitle: chat.post_id ? (postTitles.get(chat.post_id) ?? "삭제된 글") : null,
      priorityIncoming: Boolean(chat.is_priority) && chat.user2_id === user.id && !chat.closed_at,
      closed: Boolean(chat.closed_at),
    };
  });

  // 받은 진심 요청이 맨 위, 나머지는 최근 대화 순
  const activity = (chat: (typeof chats)[number], row: ChatRow) =>
    new Date(chat.lastMessage?.timestamp ?? row.created_at ?? 0).getTime();
  const rowById = new Map(rows.map((row) => [row.id, row]));
  chats.sort(
    (a, b) =>
      Number(b.priorityIncoming) - Number(a.priorityIncoming) ||
      activity(b, rowById.get(b.chatId)!) - activity(a, rowById.get(a.chatId)!),
  );

  return { chats };
}

export async function getChat(chatId: string) {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("chats")
    .select("*")
    .eq("id", chatId)
    .single();

  if (error) {
    throw error;
  }

  const chat = data as ChatRow;
  const memberRows = await getMembers([chat.id]);
  const profiles = await getProfileMap(memberRows.map((member) => member.user_id));
  const members: ChatMember[] = memberRows.map((member) => ({
    userId: member.user_id,
    name: profiles.get(member.user_id)?.name ?? "익명",
    photos: profiles.get(member.user_id)?.photos ?? [],
    role: member.role,
    lastReadAt: member.last_read_at,
  }));
  const isGroup = Boolean(chat.is_group);
  const otherUserId =
    memberRows.find((member) => member.user_id !== user.id)?.user_id ??
    (chat.user1_id === user.id ? chat.user2_id : chat.user1_id) ??
    "";
  const otherProfile = otherUserId ? await getProfileRow(otherUserId) : null;
  const postTitle = chat.post_id ? ((await getPostTitles([chat.post_id])).get(chat.post_id) ?? "삭제된 글") : null;

  return {
    chat: {
      chatId: chat.id,
      isGroup,
      title: isGroup
        ? buildGroupTitle(
            chat,
            members.filter((member) => member.userId !== user.id).map((member) => member.name),
          )
        : (otherProfile?.name ?? "익명"),
      postTitle,
      closedReason: chat.closed_at ? (chat.closed_reason ?? "closed") : null,
      members,
      user1Id: chat.user1_id ?? "",
      user2Id: chat.user2_id ?? "",
      matchRequester: chat.match_requester ?? null,
      matchStatus: chat.match_status ?? "none",
      meetSuccessUser1: chat.meet_success_user1 ?? false,
      meetSuccessUser2: chat.meet_success_user2 ?? false,
      otherUser: {
        userId: otherUserId,
        name: otherProfile?.name ?? "익명",
        photos: otherProfile?.photos ?? [],
        height: otherProfile?.height ?? undefined,
        age: otherProfile?.age ?? undefined,
        location: otherProfile?.location ?? undefined,
        gender: otherProfile?.gender ?? undefined,
        mbti: otherProfile?.mbti ?? undefined,
        trustScore: otherProfile?.trust_score ?? 70,
      },
    },
  };
}

// 단체 채팅에 초대할 수 있는 사람: 나와 1:1 대화를 한 적이 있는 사람
export async function getChatPartners() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("chats")
    .select("user1_id, user2_id")
    .eq("is_group", false);

  if (error) {
    throw error;
  }

  const ids = [
    ...new Set(
      ((data ?? []) as ChatRow[])
        .map((chat) => (chat.user1_id === user.id ? chat.user2_id : chat.user1_id))
        .filter((id): id is string => Boolean(id) && id !== user.id),
    ),
  ];
  const profiles = await getProfileMap(ids);

  return {
    partners: ids.map((id) => ({
      userId: id,
      name: profiles.get(id)?.name ?? "익명",
      photos: profiles.get(id)?.photos ?? [],
    })),
  };
}

export async function createGroupChat(payload: { title: string; memberIds: string[] }) {
  const { data, error } = await supabase.rpc("create_group_chat", {
    p_title: payload.title,
    p_member_ids: payload.memberIds,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { chatId: data as string };
}

export async function inviteMembers(payload: { chatId: string; userIds: string[] }) {
  const { error } = await supabase
    .from("chat_members")
    .insert(payload.userIds.map((userId) => ({ chat_id: payload.chatId, user_id: userId, role: "member" })));

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function leaveChat(chatId: string) {
  const user = await requireUser();
  const { error } = await supabase
    .from("chat_members")
    .delete()
    .eq("chat_id", chatId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

// 지금 보고 있는 채팅방을 "여기까지 읽음"으로 기록한다
export async function markChatRead(chatId: string) {
  const { error } = await supabase.rpc("mark_chat_read", { p_chat_id: chatId });

  if (error) {
    throw new Error(error.message);
  }
}

// 매칭 글로 대화 시작: 글마다 방이 따로 생긴다. 이미 있으면 그 방으로. 대화는 무료(매칭권은 매칭 요청 때).
export async function startPostChat(postId: string) {
  const { data, error } = await supabase.rpc("start_post_chat", { p_post_id: postId });

  if (error) {
    throw new Error(error.message);
  }

  return data as { chatId: string };
}

// 매칭 화면 통계: 오늘·누적 매칭 성공 건수 (전체 사용자 기준)
export async function getMatchStats() {
  const { data, error } = await supabase.rpc("get_match_stats");

  if (error) {
    throw error;
  }

  const stats = (data ?? {}) as { today_matched?: number; total_matched?: number };
  return {
    todayMatched: stats.today_matched ?? 0,
    totalMatched: stats.total_matched ?? 0,
  };
}
