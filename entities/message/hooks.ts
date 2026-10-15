"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { chatKeys } from "@/entities/chat/query-keys";
import * as api from "@/entities/message/api";
import { messageKeys } from "@/entities/message/query-keys";
import { supabase } from "@/shared/supabase";

export function useMessagesQuery(chatId: string, enabled = true) {
  const queryClient = useQueryClient();
  const active = enabled && Boolean(chatId);

  // 새 메시지가 저장되면 Supabase Realtime이 바로 알려준다. 받으면 목록만 다시 불러온다.
  useEffect(() => {
    if (!active) {
      return;
    }

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: messageKeys.list(chatId) });
          void queryClient.invalidateQueries({ queryKey: chatKeys.lists() });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [active, chatId, queryClient]);

  return useQuery({
    queryKey: messageKeys.list(chatId),
    queryFn: () => api.getMessages(chatId),
    enabled: active,
  });
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.sendMessage,
    onSuccess: (_, variables) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: messageKeys.list(variables.chatId) }),
        queryClient.invalidateQueries({ queryKey: chatKeys.lists() }),
      ]),
  });
}
