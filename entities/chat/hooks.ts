"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/entities/chat/api";
import { chatKeys } from "@/entities/chat/query-keys";
import { useRefreshWallet } from "@/entities/wallet/hooks";
import { supabase } from "@/shared/supabase";

export function useChatsQuery(enabled = true) {
  return useQuery({
    queryKey: chatKeys.lists(),
    queryFn: api.getChats,
    enabled,
  });
}

export function useChatDetailQuery(chatId: string, enabled = true) {
  const queryClient = useQueryClient();
  const active = enabled && Boolean(chatId);

  // 참여자의 "마지막으로 읽은 시각"이 바뀌면(상대가 읽으면) 바로 다시 불러와 읽음 표시를 갱신한다.
  useEffect(() => {
    if (!active) {
      return;
    }

    const channel = supabase
      .channel(`chat_members:${chatId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_members", filter: `chat_id=eq.${chatId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [active, chatId, queryClient]);

  return useQuery({
    queryKey: chatKeys.detail(chatId),
    queryFn: () => api.getChat(chatId),
    enabled: enabled && Boolean(chatId),
  });
}

// 1분마다 다시 불러와 다른 사람의 매칭 성사도 반영한다
export function useMatchStatsQuery(enabled = true) {
  return useQuery({
    queryKey: [...chatKeys.all, "match-stats"],
    queryFn: api.getMatchStats,
    enabled,
    refetchInterval: 60 * 1000,
  });
}

export function useChatPartnersQuery(enabled = true) {
  return useQuery({
    queryKey: [...chatKeys.lists(), "partners"],
    queryFn: api.getChatPartners,
    enabled,
  });
}

export function useCreateGroupChatMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createGroupChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.lists() }),
  });
}

export function useInviteMembersMutation(chatId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userIds: string[]) => api.inviteMembers({ chatId, userIds }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chatKeys.detail(chatId) }),
        queryClient.invalidateQueries({ queryKey: chatKeys.lists() }),
      ]);
    },
  });
}

export function useLeaveChatMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.leaveChat,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chatKeys.lists() }),
  });
}

export function useStartPostChatMutation() {
  const queryClient = useQueryClient();
  const refreshWallet = useRefreshWallet();

  return useMutation({
    mutationFn: api.startPostChat,
    onSuccess: () =>
      Promise.all([queryClient.invalidateQueries({ queryKey: chatKeys.lists() }), refreshWallet()]),
  });
}
