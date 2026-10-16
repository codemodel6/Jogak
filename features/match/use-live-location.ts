"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { updateLiveLocation } from "@/entities/match/api";

// 보내는 간격: 5초에 한 번, 또는 15m 넘게 움직였을 때
const MIN_INTERVAL_MS = 5000;
const MIN_DISTANCE_M = 15;

// 두 좌표 사이 거리(m)
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// 매칭 중 내 위치를 계속 보내는 훅. 화면이 열려 있는 동안만 동작한다(웹의 한계).
export function useLiveLocationSharing(chatId: string, enabled: boolean) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSent = useRef<{ lat: number; lng: number; at: number } | null>(null);
  // 매칭이 끝나면(취소·만남 성사 등) 공유를 끈다. 다음 매칭에서 저절로 다시 켜지지 않게 한다.
  const [prevEnabled, setPrevEnabled] = useState(enabled);
  if (prevEnabled !== enabled) {
    setPrevEnabled(enabled);
    if (!enabled) {
      setSharing(false);
    }
  }

  const active = sharing && enabled && Boolean(chatId);

  useEffect(() => {
    if (!active) {
      return;
    }

    lastSent.current = null;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        const previous = lastSent.current;
        const now = Date.now();

        if (previous && now - previous.at < MIN_INTERVAL_MS && distanceMeters(previous, next) < MIN_DISTANCE_M) {
          return;
        }

        lastSent.current = { ...next, at: now };
        updateLiveLocation({ chatId, ...next })
          .then(() => setError(null))
          .catch((err: unknown) => setError(err instanceof Error ? err.message : "위치를 보내지 못했어요."));
      },
      () => {
        setError("위치 권한이 없어서 위치를 공유할 수 없어요.");
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [active, chatId]);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError("이 브라우저에서는 위치를 사용할 수 없어요.");
      return;
    }
    setError(null);
    setSharing(true);
  }, []);
  const stop = useCallback(() => setSharing(false), []);

  return { sharing: active, error, start, stop };
}
