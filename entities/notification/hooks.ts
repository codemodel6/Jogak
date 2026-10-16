"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AppNotification, NotificationSettings } from "@/entities/notification";
import * as api from "@/entities/notification/api";
import { notificationKeys } from "@/entities/notification/query-keys";
import { supabase } from "@/shared/supabase";

// 새 알림이 생기거나 지워지면 종 숫자·목록을 바로 갱신한다
function useNotificationRealtime(userId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

export function useNotificationCountQuery(userId: string | undefined) {
  useNotificationRealtime(userId);

  return useQuery({
    queryKey: notificationKeys.count(),
    queryFn: api.getNotificationCount,
    enabled: Boolean(userId),
  });
}

export function useNotificationsQuery(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.list(),
    queryFn: api.getNotifications,
    enabled,
  });
}

// 하나 지우기 / 모두 지우기: 목록과 숫자를 먼저 바꾸고, 실패하면 되돌린다
function useRemoveNotificationsMutation<T>(remove: (variables: T) => Promise<void>, keep: (item: AppNotification, variables: T) => boolean) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: remove,
    onMutate: async (variables: T) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const list = queryClient.getQueryData<AppNotification[]>(notificationKeys.list());
      const count = queryClient.getQueryData<number>(notificationKeys.count());
      if (list) {
        const next = list.filter((item) => keep(item, variables));
        queryClient.setQueryData(notificationKeys.list(), next);
        if (count !== undefined) queryClient.setQueryData(notificationKeys.count(), Math.max(0, count - (list.length - next.length)));
      }
      return { list, count };
    },
    onError: (_error, _variables, context) => {
      if (context?.list) queryClient.setQueryData(notificationKeys.list(), context.list);
      if (context?.count !== undefined) queryClient.setQueryData(notificationKeys.count(), context.count);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export const useDeleteNotificationMutation = () =>
  useRemoveNotificationsMutation<number>(api.deleteNotification, (item, id) => item.id !== id);

export const useClearNotificationsMutation = () =>
  useRemoveNotificationsMutation<void>(() => api.clearNotifications(), () => false);

export function useNotificationSettingsQuery(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.settings(),
    queryFn: api.getNotificationSettings,
    enabled,
  });
}

export function useSaveNotificationSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: NotificationSettings) => api.saveNotificationSettings(settings),
    onMutate: async (settings) => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.settings() });
      const previous = queryClient.getQueryData<NotificationSettings>(notificationKeys.settings());
      queryClient.setQueryData(notificationKeys.settings(), settings);
      return { previous };
    },
    onError: (_error, _settings, context) => {
      if (context?.previous) queryClient.setQueryData(notificationKeys.settings(), context.previous);
    },
  });
}
