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

export function useUploadPhotoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.uploadPhoto,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: profileKeys.me() }),
  });
}

export function useDeletePhotoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deletePhoto,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: profileKeys.me() }),
  });
}

export function useReplacePhotoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.replacePhoto,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: profileKeys.me() }),
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
