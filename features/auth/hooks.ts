"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/features/auth/api";
import { authKeys } from "@/features/auth/query-keys";

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

// 로그인·가입으로 세션이 바뀌면 캐시를 통째로 비운다.
// 첫 화면에서 받아 둔 '로그인 안 됨'이 남아 있으면 홈이 그걸 보고 다시 로그인 화면으로 보내기 때문이다.
export function useSignInMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.signInWithPassword,
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useGoogleSignInMutation() {
  return useMutation({
    mutationFn: api.signInWithGoogle,
  });
}

export function useRequestSignUpCodeMutation() {
  return useMutation({ mutationFn: api.requestSignUpCode });
}

export function useVerifySignUpCodeMutation() {
  return useMutation({ mutationFn: api.verifySignUpCode });
}

export function useCompleteSignUpMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.completeSignUp,
    onSuccess: () => {
      queryClient.clear();
    },
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
