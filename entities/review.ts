export type ReviewPerson = {
  userId: string;
  name: string;
  photo?: string;
};

export type Review = {
  reviewId: string;
  rating: number;
  tags: string[];
  content: string;
  createdAt: string;
  reviewer: ReviewPerson;
  reviewee: ReviewPerson;
};

// all: 게시판 후기 분류(전체) / received: 내가 받은 후기 / written: 내가 쓴 후기
export type ReviewScope = "all" | "received" | "written";
