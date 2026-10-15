"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/shared/supabase";

// 접속 중인 사용자 수: 로그인한 사람이 화면을 열고 있는 동안 Realtime Presence 에 참여한다.
// 같은 사람이 탭을 여러 개 열어도 1명으로 센다(사용자 id 를 presence key 로 사용).
let channel: RealtimeChannel | null = null;
let refCount = 0;
let onlineCount = 0;
let onlineIds: string[] = [];
const EMPTY_IDS: string[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function join(userId: string) {
  refCount += 1;
  if (channel) {
    return;
  }

  const current = supabase.channel("online-users", { config: { presence: { key: userId } } });
  channel = current;
  current
    .on("presence", { event: "sync" }, () => {
      onlineIds = Object.keys(current.presenceState());
      onlineCount = onlineIds.length;
      emit();
    })
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void current.track({ onlineAt: new Date().toISOString() });
      }
    });
}

function leave() {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || !channel) {
    return;
  }

  void supabase.removeChannel(channel);
  channel = null;
  onlineCount = 0;
  onlineIds = EMPTY_IDS;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function useJoin(userId: string | undefined) {
  useEffect(() => {
    if (!userId) {
      return;
    }

    join(userId);
    return leave;
  }, [userId]);
}

export function useOnlineUsers(userId: string | undefined) {
  useJoin(userId);

  return useSyncExternalStore(
    subscribe,
    () => onlineCount,
    () => 0,
  );
}

// 지금 접속 중인 사용자 id 목록(ONLINE 표시용)
export function useOnlineUserIds(userId: string | undefined) {
  useJoin(userId);

  return useSyncExternalStore(
    subscribe,
    () => onlineIds,
    () => EMPTY_IDS,
  );
}
