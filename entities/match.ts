export type MatchStatus =
  | "requested"
  | "matched"
  | "met"
  | "declined"
  | "cancelled"
  | "expired"
  | "reported"
  | "withdrawn";

export type Match = {
  matchId: string;
  chatId: string;
  requesterId: string;
  receiverId: string;
  status: MatchStatus;
  requestedAt: string;
  matchedAt: string | null;
  requesterMet: boolean;
  receiverMet: boolean;
  // 요청한 사람이 상대 실물을 보고 [매칭]을 골랐는지. 그 뒤에야 받은 사람이 사진을 보고 답한다.
  requesterConfirmed: boolean;
  isPriority: boolean;
};

// 나에게 걸린 "신뢰 점수 -1 예정" (상대가 못 만났어요를 누른 경우)
export type PendingPenalty = {
  penaltyId: string;
  chatId: string;
  reporterName: string;
  dueAt: string;
};

export type LiveLocation = {
  userId: string;
  lat: number;
  lng: number;
  updatedAt: string;
};
