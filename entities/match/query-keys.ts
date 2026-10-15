import { createQueryKeys } from "@lukemorales/query-key-factory";

const matchKeyFactory = createQueryKeys("matches", {
  active: (chatId: string) => [chatId],
  penalties: null,
  locations: (chatId: string) => [chatId],
});

export const matchKeys = {
  all: matchKeyFactory._def,
  active: (chatId: string) => matchKeyFactory.active(chatId).queryKey,
  penalties: () => matchKeyFactory.penalties.queryKey,
  locations: (chatId: string) => matchKeyFactory.locations(chatId).queryKey,
} as const;
