import { createQueryKeys } from "@lukemorales/query-key-factory";

const walletKeyFactory = createQueryKeys("wallet", {
  mine: null,
  history: null,
});

export const walletKeys = {
  all: walletKeyFactory._def,
  mine: () => walletKeyFactory.mine.queryKey,
  history: () => walletKeyFactory.history.queryKey,
} as const;
