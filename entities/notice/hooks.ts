"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/entities/notice/api";

const boardKeys = {
  all: ["board"] as const,
  list: () => [...boardKeys.all, "list"] as const,
  detail: (postId: number) => [...boardKeys.all, "detail", postId] as const,
  comments: (postId: number) => [...boardKeys.all, "comments", postId] as const,
};

export function useBoardPostsQuery(enabled = true) {
  return useQuery({ queryKey: boardKeys.list(), queryFn: api.getBoardPosts, enabled });
}

export function useBoardPostQuery(postId: number, enabled = true) {
  return useQuery({ queryKey: boardKeys.detail(postId), queryFn: () => api.getBoardPost(postId), enabled });
}

export function useBoardCommentsQuery(postId: number, enabled = true) {
  return useQuery({ queryKey: boardKeys.comments(postId), queryFn: () => api.getBoardComments(postId), enabled });
}

export function useAddBoardCommentMutation(postId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => api.addBoardComment({ postId, content }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: boardKeys.comments(postId) }),
        queryClient.invalidateQueries({ queryKey: boardKeys.list() }),
      ]);
    },
  });
}

export function useDeleteBoardCommentMutation(postId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteBoardComment,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: boardKeys.comments(postId) }),
        queryClient.invalidateQueries({ queryKey: boardKeys.list() }),
      ]);
    },
  });
}
