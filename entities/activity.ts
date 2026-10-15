export type ActivityType = "매칭" | "대화" | "후기";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  at: string;
  href?: string;
};

export type MyActivity = {
  metCount: number;
  metThisMonth: number;
  reviewCount: number;
  reviewThisMonth: number;
  averageRating: number | null;
  // 받은 대화 요청 중 내가 답장한 비율(받은 요청이 없으면 null)
  responseRate: number | null;
  receivedRequests: number;
  answeredRequests: number;
  averageResponseMinutes: number | null;
  // 최근 6개월 매칭 성공(만남 성사) 건수, 오래된 달부터
  monthly: Array<{ month: string; count: number }>;
  items: ActivityItem[];
};
