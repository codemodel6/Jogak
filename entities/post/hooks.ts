"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/entities/post/api";
import { postKeys } from "@/entities/post/query-keys";
import { useRefreshWallet } from "@/entities/wallet/hooks";

export function usePostsQuery(enabled = true) {
  return useQuery({
    queryKey: postKeys.lists(),
    queryFn: api.getPosts,
    enabled,
  });
}

export function useCreatePostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createPost,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: postKeys.lists() }),
  });
}

export function useBoostPostMutation() {
  const queryClient = useQueryClient();
  const refreshWallet = useRefreshWallet();

  return useMutation({
    mutationFn: api.boostPost,
    onSettled: () =>
      Promise.all([queryClient.invalidateQueries({ queryKey: postKeys.lists() }), refreshWallet()]),
  });
}
