"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/entities/profile/api";
import { profileKeys } from "@/entities/profile/query-keys";

export function useProfileQuery(enabled = true) {
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: api.getProfile,
    enabled,
  });
}

export function useUserProfileQuery(userId: string | null) {
  return useQuery({
    queryKey: [...profileKeys.me(), "user", userId],
    queryFn: () => api.getUserProfile(userId ?? ""),
    enabled: Boolean(userId),
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.updateProfile,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: profileKeys.me() }),
  });
}

export function useSetAvatarMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.setAvatar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.me() }),
  });
}

export function useSetFacePhotoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.setFacePhoto,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKeys.me() }),
  });
}

// 실물 사진 링크: 권한이 없으면 null (아이콘·기본 이미지로 대신 보여 준다)
export function useFacePhotoUrlQuery(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...profileKeys.all, "face", userId],
    queryFn: () => api.getFacePhotoUrl(userId as string),
    enabled: enabled && Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecoverTrustMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.recoverTrust,
    onSuccess: (data) => queryClient.setQueryData(profileKeys.me(), data),
  });
}

export function useCompleteOnboardingMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.completeOnboarding,
    onSuccess: (data) => queryClient.setQueryData(profileKeys.me(), data),
  });
}
