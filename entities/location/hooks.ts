"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/entities/location/api";
import { locationKeys } from "@/entities/location/query-keys";
import { profileKeys } from "@/entities/profile/query-keys";

export function useLocationQuery(chatId: string, userId: string, enabled = true) {
  return useQuery({
    queryKey: locationKeys.detail(chatId, userId),
    queryFn: () => api.getLocation(chatId, userId),
    enabled: enabled && Boolean(chatId) && Boolean(userId),
  });
}

export function useShareLocationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.shareLocation,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileKeys.me() }),
        queryClient.invalidateQueries({ queryKey: locationKeys.all }),
      ]);
    },
  });
}
