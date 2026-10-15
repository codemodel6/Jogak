"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/features/auth/api";
import { authKeys } from "@/features/auth/query-keys";
import { chatKeys } from "@/entities/chat/query-keys";
import { locationKeys } from "@/entities/location/query-keys";
import { messageKeys } from "@/entities/message/query-keys";
import { postKeys } from "@/entities/post/query-keys";
import { profileKeys } from "@/entities/profile/query-keys";

export function useAuthStatusQuery() {
  return useQuery({
    queryKey: authKeys.status(),
    queryFn: api.getAuthStatus,
  });
}

export function useCurrentUserIdQuery(enabled = true) {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: api.getCurrentUserId,
    enabled,
  });
}

export function useSignInMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.signInWithPassword,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: authKeys.all }),
        queryClient.invalidateQueries({ queryKey: profileKeys.all }),
        queryClient.invalidateQueries({ queryKey: postKeys.all }),
        queryClient.invalidateQueries({ queryKey: chatKeys.all }),
        queryClient.invalidateQueries({ queryKey: messageKeys.all }),
        queryClient.invalidateQueries({ queryKey: locationKeys.all }),
      ]);
    },
  });
}

export function useGoogleSignInMutation() {
  return useMutation({
    mutationFn: api.signInWithGoogle,
  });
}

export function useSignUpMutation() {
  return useMutation({
    mutationFn: api.signUpWithPassword,
  });
}

export function useSignOutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.signOut,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
