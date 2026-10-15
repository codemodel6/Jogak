import { createQueryKeys } from "@lukemorales/query-key-factory";

import type { ReviewScope } from "@/entities/review";

const reviewKeyFactory = createQueryKeys("reviews", {
  list: (scope: ReviewScope) => [scope],
  detail: (reviewId: string) => [reviewId],
});

export const reviewKeys = {
  all: reviewKeyFactory._def,
  list: (scope: ReviewScope) => reviewKeyFactory.list(scope).queryKey,
  detail: (reviewId: string) => reviewKeyFactory.detail(reviewId).queryKey,
} as const;
