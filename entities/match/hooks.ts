"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { chatKeys } from "@/entities/chat/query-keys";
import * as api from "@/entities/match/api";
import { matchKeys } from "@/entities/match/query-keys";
import { profileKeys } from "@/entities/profile/query-keys";
import { walletKeys } from "@/entities/wallet/query-keys";
import { supabase } from "@/shared/supabase";

// 매칭 상태가 바뀌면(상대가 요청·수락·만났어요) 양쪽 화면에 바로 반영한다.
export function useActiveMatchQuery(chatId: string, enabled = true) {
  const queryClient = useQueryClient();
  const active = enabled && Boolean(chatId);

  useEffect(() => {
    if (!active) {
      return;
    }

    const channel = supabase
      .channel(`matches:${chatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches", filter: `chat_id=eq.${chatId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: matchKeys.active(chatId) });
          void queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
          void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [active, chatId, queryClient]);

  return useQuery({
    queryKey: matchKeys.active(chatId),
    queryFn: () => api.getActiveMatch(chatId),
    enabled: active,
    // 24시간 기한이 지나면 자동 종료되므로 가끔 다시 확인한다
    refetchInterval: 60 * 1000,
  });
}

// 나에게 걸린 감점 예정. 신고가 들어오면 실시간으로 뜬다.
// 실시간 구독은 메인 레이아웃 한 곳에서만 하고(live), 다른 곳은 같은 캐시를 읽기만 한다.
export function useMyPendingPenaltiesQuery(userId: string | undefined, live = false) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !live) {
      return;
    }

    const channel = supabase
      .channel(`trust_penalties:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trust_penalties", filter: `user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: matchKeys.penalties() });
          void queryClient.invalidateQueries({ queryKey: profileKeys.me() });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, live, queryClient]);

  return useQuery({
    queryKey: matchKeys.penalties(),
    queryFn: api.getMyPendingPenalties,
    enabled: Boolean(userId),
    refetchInterval: 60 * 1000,
  });
}

// 매칭 중 두 사람의 위치. 상대가 움직이면 실시간으로 갱신된다.
export function useChatLocationsQuery(chatId: string, enabled = true) {
  const queryClient = useQueryClient();
  const active = enabled && Boolean(chatId);

  useEffect(() => {
    if (!active) {
      return;
    }

    const channel = supabase
      .channel(`locations:${chatId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "locations", filter: `chat_id=eq.${chatId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: matchKeys.locations(chatId) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [active, chatId, queryClient]);

  return useQuery({
    queryKey: matchKeys.locations(chatId),
    queryFn: () => api.getChatLocations(chatId),
    enabled: active,
  });
}

function useMatchMutation<TVariables, TData>(chatId: string, mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: matchKeys.active(chatId) }),
        queryClient.invalidateQueries({ queryKey: matchKeys.penalties() }),
        queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) }),
        queryClient.invalidateQueries({ queryKey: chatKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: profileKeys.me() }),
        queryClient.invalidateQueries({ queryKey: walletKeys.all }),
      ]);
    },
  });
}

export const useRequestMatchMutation = (chatId: string) =>
  useMatchMutation(chatId, (priority: boolean) => api.requestMatch({ chatId, priority }));
export const useDecideMatchRequestMutation = (chatId: string) => useMatchMutation(chatId, api.decideMatchRequest);
export const useWithdrawMatchMutation = (chatId: string) => useMatchMutation(chatId, api.withdrawMatch);
export const useRespondMatchMutation = (chatId: string) => useMatchMutation(chatId, api.respondMatch);
export const useCancelMatchMutation = (chatId: string) => useMatchMutation(chatId, api.cancelMatch);
export const useConfirmMeetMutation = (chatId: string) => useMatchMutation(chatId, api.confirmMeet);
export const useReportNoShowMutation = (chatId: string) => useMatchMutation(chatId, api.reportNoShow);
export const useContestPenaltyMutation = (chatId: string) => useMatchMutation(chatId, api.contestPenalty);
