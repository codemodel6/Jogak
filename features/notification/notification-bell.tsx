"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiAlertTriangle, FiBell, FiFileText, FiHeart, FiMessageCircle, FiSettings, FiStar } from "react-icons/fi";

import type { AppNotification } from "@/entities/notification";
import {
  useClearNotificationsMutation,
  useDeleteNotificationMutation,
  useNotificationCountQuery,
  useNotificationsQuery,
} from "@/entities/notification/hooks";
import Skeleton from "@/shared/ui/skeleton";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function timeAgo(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  const date = new Date(value);
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function iconFor(item: AppNotification) {
  if (item.type.startsWith("penalty")) return { Icon: FiAlertTriangle, tone: "text-rose-300 bg-rose-500/12" };
  if (item.type === "review_received") return { Icon: FiStar, tone: "text-amber-300 bg-amber-400/12" };
  if (item.category === "chat") return { Icon: FiMessageCircle, tone: "text-sky-200 bg-sky-500/12" };
  if (item.category === "event") return { Icon: FiFileText, tone: "text-emerald-300 bg-emerald-500/12" };
  return { Icon: FiHeart, tone: "text-violet-300 bg-violet-500/14" };
}

// 머리글 종: 숫자는 남아 있는 알림 개수. 누르면 바로 아래에 알림 목록이 펼쳐진다.
// 알림을 누르면 그 알림은 지워지고(연결된 화면이 있으면 이동), 맨 아래 '모두 지우기'로 전부 지운다.
export default function NotificationBell({ userId }: { userId: string | undefined }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = useNotificationCountQuery(userId).data ?? 0;
  const listQuery = useNotificationsQuery(open && Boolean(userId));
  const deleteMutation = useDeleteNotificationMutation();
  const clearMutation = useClearNotificationsMutation();
  const items = listQuery.data ?? [];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleItem = (item: AppNotification) => {
    deleteMutation.mutate(item.id);
    if (item.link) {
      setOpen(false);
      router.push(item.link);
    }
  };

  return (
    <div ref={rootRef} className="relative flex">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={count > 0 ? `알림 ${count}개` : "알림"}
        aria-expanded={open}
        className="relative"
      >
        <FiBell className="text-[1.5rem] text-white" />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#6f56ff] px-1 text-[0.68rem] font-semibold text-on-accent">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 top-[72px] z-[140] flex max-h-[70dvh] flex-col overflow-hidden rounded-[18px] border border-white/10 bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.35)] md:absolute md:inset-x-auto md:right-0 md:top-full md:mt-3 md:w-[380px]">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <p className="text-[0.95rem] font-semibold text-white">
              알림 <span className="text-violet-300">{count}</span>
            </p>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1 text-[0.8rem] text-zinc-400 transition hover:text-white"
            >
              <FiSettings />
              알림 설정
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {listQuery.isPending ? (
              Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="flex items-start gap-3 px-2.5 py-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3 rounded-md" />
                    <Skeleton className="h-3.5 w-4/5 rounded-md" />
                  </div>
                </div>
              ))
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2.5 py-10 text-center">
                <FiBell className="text-[1.6rem] text-zinc-500" />
                <p className="text-[0.86rem] text-zinc-400">알림이 없어요.</p>
              </div>
            ) : (
              <ul>
                {items.map((item) => {
                  const { Icon, tone } = iconFor(item);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleItem(item)}
                        className="flex w-full items-start gap-3 rounded-[12px] px-2.5 py-3 text-left transition hover:bg-white/5"
                      >
                        <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", tone)}>
                          <Icon className="text-[1rem]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[0.88rem] font-semibold text-white">{item.title}</span>
                            <span className="ml-auto shrink-0 text-[0.72rem] text-zinc-500">{timeAgo(item.createdAt)}</span>
                          </span>
                          <span className="mt-0.5 block break-keep text-[0.8rem] leading-5 text-zinc-300">{item.body}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <button
              type="button"
              onClick={() => clearMutation.mutate()}
              disabled={clearMutation.isPending}
              className="border-t border-white/8 py-3 text-center text-[0.86rem] font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white disabled:opacity-60"
            >
              모두 지우기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
