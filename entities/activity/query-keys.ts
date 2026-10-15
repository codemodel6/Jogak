import { createQueryKeys } from "@lukemorales/query-key-factory";

const activityKeyFactory = createQueryKeys("activity", {
  mine: null,
});

export const activityKeys = {
  all: activityKeyFactory._def,
  mine: () => activityKeyFactory.mine.queryKey,
} as const;
