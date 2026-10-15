"use client";

import { useQuery } from "@tanstack/react-query";

import * as api from "@/entities/activity/api";
import { activityKeys } from "@/entities/activity/query-keys";

export function useMyActivityQuery(enabled = true) {
  return useQuery({
    queryKey: activityKeys.mine(),
    queryFn: api.getMyActivity,
    enabled,
  });
}
