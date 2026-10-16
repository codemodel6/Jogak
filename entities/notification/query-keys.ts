import { createQueryKeys } from "@lukemorales/query-key-factory";

const notificationKeyFactory = createQueryKeys("notifications", {
  list: null,
  count: null,
  settings: null,
});

export const notificationKeys = {
  all: notificationKeyFactory._def,
  list: () => notificationKeyFactory.list.queryKey,
  count: () => notificationKeyFactory.count.queryKey,
  settings: () => notificationKeyFactory.settings.queryKey,
} as const;
