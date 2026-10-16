"use client";

import Link from "next/link";
import { FiTrendingUp, FiX } from "react-icons/fi";

import { isBoosted } from "@/entities/post";
import { PRICE } from "@/entities/wallet";

type BoostSheetProps = {
  postTitle: string;
  points: number | undefined;
  boostedUntil?: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

function formatTime(value: string) {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// 내 글 상단 노출(2P, 1시간): 실시간 매칭 카드와 매칭 목록 맨 앞에 보인다
export default function BoostSheet({ postTitle, points, boostedUntil, pending, error, onConfirm, onClose }: BoostSheetProps) {
  const active = isBoosted({ boostedUntil });
  const enough = (points ?? 0) >= PRICE.postBoost;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="상단 노출"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full rounded-t-[26px] border border-white/10 bg-surface px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-6 shadow-2xl sm:max-w-[420px] sm:rounded-[26px] sm:pb-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/8 hover:text-white"
        >
          <FiX className="text-[1.15rem]" />
        </button>
        <p className="flex items-center gap-1.5 text-[0.8rem] font-medium text-violet-300">
          <FiTrendingUp /> 내 글 상단 노출
        </p>
        <h2 className="mt-1 line-clamp-2 break-keep pr-8 text-[1.15rem] font-semibold text-white">{postTitle}</h2>
        <p className="mt-3 break-keep text-[0.86rem] leading-6 text-zinc-300">
          1시간 동안 홈의 실시간 매칭 카드와 매칭 목록 <b className="text-white">맨 앞</b>에 보여요.
          {active && ` 지금 ${formatTime(boostedUntil as string)}까지 노출 중이라 1시간 연장돼요.`}
        </p>
        <button
          type="button"
          disabled={pending || !enough}
          onClick={onConfirm}
          className="mt-5 h-12 w-full rounded-[14px] bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] text-[0.95rem] font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "처리 중..." : `${PRICE.postBoost}P로 ${active ? "1시간 연장" : "상단 노출"}`}
        </button>
        <p className="mt-3 text-center text-[0.76rem] text-zinc-500">보유 {(points ?? 0).toLocaleString()}P</p>
        {error && <div className="alert-error mt-3 break-keep">{error}</div>}
        {!enough && points !== undefined && (
          <Link href="/points" className="mt-3 block text-center text-[0.84rem] font-semibold text-violet-300 underline underline-offset-2">
            신뢰 포인트 충전하러 가기
          </Link>
        )}
      </div>
    </div>
  );
}
