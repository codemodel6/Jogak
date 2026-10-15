"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { activityKeys } from "@/entities/activity/query-keys";
import type { ReviewScope } from "@/entities/review";
import { matchKeys } from "@/entities/match/query-keys";
import * as api from "@/entities/review/api";
import { reviewKeys } from "@/entities/review/query-keys";
import { supabase } from "@/shared/supabase";

// 새 후기가 올라오면 게시판에 바로 반영한다.
export function useReviewsQuery(scope: ReviewScope, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const channel = supabase
      .channel(`reviews:${scope}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reviews" }, () => {
        void queryClient.invalidateQueries({ queryKey: reviewKeys.all });
        void queryClient.invalidateQueries({ queryKey: activityKeys.all });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, scope, queryClient]);

  return useQuery({
    queryKey: reviewKeys.list(scope),
    queryFn: () => api.getReviews(scope),
    enabled,
  });
}

export function useReviewQuery(reviewId: string, enabled = true) {
  return useQuery({
    queryKey: reviewKeys.detail(reviewId),
    queryFn: () => api.getReview(reviewId),
    enabled: enabled && Boolean(reviewId),
  });
}

export function useSubmitReviewMutation(chatId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.submitReview,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: matchKeys.active(chatId) }),
        queryClient.invalidateQueries({ queryKey: reviewKeys.all }),
        queryClient.invalidateQueries({ queryKey: activityKeys.all }),
      ]),
  });
}
