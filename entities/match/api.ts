import type { LiveLocation, Match, MatchStatus, PendingPenalty } from "@/entities/match";
import { supabase } from "@/shared/supabase";
import { getProfileMap, requireUser } from "@/shared/lib/supabase/helpers";

type MatchRow = {
  id: string;
  chat_id: string;
  requester_id: string;
  receiver_id: string;
  status: MatchStatus;
  requested_at: string;
  matched_at: string | null;
  requester_met: boolean;
  receiver_met: boolean;
  requester_confirmed: boolean;
  is_priority: boolean;
};

type PenaltyRow = {
  id: string;
  chat_id: string;
  reporter_id: string | null;
  due_at: string;
};

type LocationRow = {
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
};

function toMatch(row: MatchRow): Match {
  return {
    matchId: row.id,
    chatId: row.chat_id,
    requesterId: row.requester_id,
    receiverId: row.receiver_id,
    status: row.status,
    requestedAt: row.requested_at,
    matchedAt: row.matched_at,
    requesterMet: row.requester_met,
    receiverMet: row.receiver_met,
    requesterConfirmed: row.requester_confirmed,
    isPriority: row.is_priority,
  };
}

async function callRpc<T>(name: string, params?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, params);

  if (error) {
    throw new Error(error.message);
  }

  return data as T;
}

// 기한이 지난 감점·매칭을 처리한다. 예약 작업(1분)과 별개로 화면을 열 때도 한 번 돌려 바로 반영한다.
export async function processDeadlines() {
  await callRpc<null>("process_match_deadlines");
}

// 이 채팅방의 현재 매칭: 요청 대기·매칭 중, 또는 만남이 성사된 매칭(이 경우 내가 후기를 남겼는지도 함께). 없으면 null.
export async function getActiveMatch(chatId: string) {
  await processDeadlines();
  const user = await requireUser();
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .eq("chat_id", chatId)
    .in("status", ["requested", "matched", "met"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const match = data ? toMatch(data as MatchRow) : null;
  let reviewed = false;

  if (match?.status === "met") {
    const { count, error: reviewError } = await supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("match_id", match.matchId)
      .eq("reviewer_id", user.id);

    if (reviewError) {
      throw reviewError;
    }
    reviewed = (count ?? 0) > 0;
  }

  return { match, reviewed };
}

export async function getMyPendingPenalties() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("trust_penalties")
    .select("id, chat_id, reporter_id, due_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .gt("due_at", new Date().toISOString())
    .order("due_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as PenaltyRow[];
  const profiles = await getProfileMap(
    [...new Set(rows.map((row) => row.reporter_id).filter((id): id is string => Boolean(id)))],
  );

  const penalties: PendingPenalty[] = rows.map((row) => ({
    penaltyId: row.id,
    chatId: row.chat_id,
    reporterName: (row.reporter_id && profiles.get(row.reporter_id)?.name) || "상대",
    dueAt: row.due_at,
  }));

  return { penalties };
}

export async function getChatLocations(chatId: string) {
  const { data, error } = await supabase
    .from("locations")
    .select("user_id, lat, lng, updated_at")
    .eq("chat_id", chatId);

  if (error) {
    throw error;
  }

  const locations: LiveLocation[] = ((data ?? []) as LocationRow[]).map((row) => ({
    userId: row.user_id,
    lat: row.lat,
    lng: row.lng,
    updatedAt: row.updated_at,
  }));

  return { locations };
}

// 매칭 요청: 매칭권(무료 3장 → 보너스 → 1P)을 쓴다. 진심 요청은 2P를 더 쓴다.
export async function requestMatch(payload: { chatId: string; priority?: boolean }) {
  const { data, error } = await supabase.rpc("request_match", {
    p_chat_id: payload.chatId,
    p_priority: payload.priority ?? false,
  });
  if (error) {
    // P0402: 매칭권·포인트 부족 → 화면에서 충전 안내
    throw Object.assign(new Error(error.message), { needsPoints: error.code === "P0402" });
  }
  return data as { matchId: string; paidBy: "free" | "bonus" | "points"; cost: number };
}

// 요청한 사람: 상대 실물을 보고 [매칭](true) / [거절](false). 거절하면 대화방이 닫힌다.
export const decideMatchRequest = (payload: { matchId: string; proceed: boolean }) =>
  callRpc<"confirmed" | "cancelled">("decide_match_request", { p_match_id: payload.matchId, p_proceed: payload.proceed });

// 매칭 중 매치 취소: 사유는 대화방에 시스템 메시지로 남고, 내 신뢰 점수 -1, 대화방도 닫힌다
export const withdrawMatch = (payload: { matchId: string; reason: string }) =>
  callRpc<null>("withdraw_match", { p_match_id: payload.matchId, p_reason: payload.reason });

export const respondMatch = (payload: { matchId: string; accept: boolean }) =>
  callRpc<string>("respond_match", { p_match_id: payload.matchId, p_accept: payload.accept });

export const cancelMatch = (matchId: string) => callRpc<null>("cancel_match", { p_match_id: matchId });

// 반환값: "met"(둘 다 눌러 매칭 종료, +1) 또는 "waiting"(상대 확인 대기)
export const confirmMeet = (matchId: string) => callRpc<"met" | "waiting">("confirm_meet", { p_match_id: matchId });

export const reportNoShow = (matchId: string) => callRpc<string>("report_no_show", { p_match_id: matchId });

export const contestPenalty = (penaltyId: string) => callRpc<null>("contest_penalty", { p_penalty_id: penaltyId });

export const updateLiveLocation = (payload: { chatId: string; lat: number; lng: number }) =>
  callRpc<null>("update_live_location", { p_chat_id: payload.chatId, p_lat: payload.lat, p_lng: payload.lng });
