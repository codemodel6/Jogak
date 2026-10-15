export type MatchStatus = "requested" | "matched" | "met" | "declined" | "cancelled" | "expired" | "reported";

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
