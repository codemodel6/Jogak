// 무료 매칭권(하루 3장, 한국 시간 자정에 다시 채워짐) + 보너스 매칭권 + 신뢰 포인트
export type Wallet = {
  points: number;
  freeLeft: number;
  freeTotal: number;
  bonusTickets: number;
  streak: number;
  attendedToday: boolean;
  resetsAt: string;
};

export type PointTransaction = {
  id: number;
  delta: number;
  balance: number;
  reason: string;
  createdAt: string;
};

// 유료 기능 가격 (DB 함수와 같은 값)
export const PRICE = {
  extraRequest: 1,
  priorityRequest: 2,
  postBoost: 2,
} as const;

export const POINT_REASON_LABEL: Record<string, string> = {
  charge: "포인트 충전",
  extra_request: "추가 대화 신청",
  priority_request: "진심 요청",
  post_boost: "글 상단 노출 (1시간)",
  trust_recover: "신뢰 점수 회복",
  use: "포인트 사용",
};
