"use client";

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { profileKeys } from "@/entities/profile/query-keys";
import * as api from "@/entities/wallet/api";
import { walletKeys } from "@/entities/wallet/query-keys";

export function useWalletQuery(enabled = true) {
  return useQuery({
    queryKey: walletKeys.mine(),
    queryFn: api.getMyWallet,
    enabled,
    // 자정이 지나면 무료 매칭권이 다시 채워지므로 주기적으로 새로 받는다
    refetchInterval: 5 * 60 * 1000,
  });
}

export function usePointHistoryQuery(enabled = true) {
  return useQuery({
    queryKey: walletKeys.history(),
    queryFn: api.getPointHistory,
    enabled,
  });
}

// 메인 화면에 들어오면 하루 한 번 출석 체크 (서버가 같은 날 중복은 무시한다)
export function useDailyCheckIn(userId: string | undefined) {
  const queryClient = useQueryClient();
  const doneFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || doneFor.current === userId) return;
    doneFor.current = userId;
    void api
      .checkIn()
      .then((result) => {
        queryClient.setQueryData(walletKeys.mine(), result.wallet);
      })
      .catch(() => undefined);
  }, [userId, queryClient]);
}

// 매칭권·포인트를 쓴 뒤 지갑·프로필(보유 포인트)·내역을 새로 받는다
export function useRefreshWallet() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: walletKeys.all }),
      queryClient.invalidateQueries({ queryKey: profileKeys.me() }),
    ]);
}
