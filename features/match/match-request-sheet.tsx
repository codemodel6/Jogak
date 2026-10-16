"use client";

import Link from "next/link";
import { useEffect } from "react";
import { FiHeart, FiMessageCircle, FiX } from "react-icons/fi";

import { PRICE, type Wallet } from "@/entities/wallet";

type MatchRequestSheetProps = {
  partnerName: string;
  wallet: Wallet | undefined;
  pending: boolean;
  error: string | null;
  needsPoints: boolean;
  onConfirm: (priority: boolean) => void;
  onClose: () => void;
};

// 매칭 요청 확인: 무엇을 쓰는지(무료 매칭권/보너스/포인트) 보여 주고, 진심 요청(+2P)도 고를 수 있다
export default function MatchRequestSheet({
  partnerName,
  wallet,
  pending,
  error,
  needsPoints,
  onConfirm,
  onClose,
}: MatchRequestSheetProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const points = wallet?.points ?? 0;
  const baseCost = !wallet || wallet.freeLeft > 0 || wallet.bonusTickets > 0 ? 0 : PRICE.extraRequest;
  const baseLabel = !wallet
    ? "확인 중..."
    : wallet.freeLeft > 0
      ? `무료 매칭권 1장 사용 · 오늘 ${wallet.freeLeft}/${wallet.freeTotal}장 남음`
      : wallet.bonusTickets > 0
        ? `보너스 매칭권 1장 사용 · ${wallet.bonusTickets}장 남음`
        : `오늘 무료 매칭권을 다 썼어요 · 신뢰 포인트 ${PRICE.extraRequest}P`;
  const priorityCost = baseCost + PRICE.priorityRequest;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="매칭 요청"
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

        <p className="text-[0.8rem] font-medium text-violet-300">매칭 요청</p>
        <h2 className="mt-1 break-keep pr-8 text-[1.15rem] font-semibold text-white">{partnerName}님에게 매칭을 요청할까요?</h2>
        <p className="mt-2 break-keep text-[0.82rem] leading-5 text-zinc-400">
          요청하면 <b className="text-white">{partnerName}님의 실물 사진</b>을 먼저 확인하고 매칭 또는 거절을 고를 수 있어요.
          내가 매칭을 고르면 그때 상대도 내 사진을 보고 답해요. 거절하면 대화가 종료돼요.
        </p>

        <button
          type="button"
          disabled={pending || !wallet || points < baseCost}
          onClick={() => onConfirm(false)}
          className="mt-5 flex w-full items-center gap-3 rounded-[16px] bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] px-4 py-3.5 text-left text-on-accent transition hover:brightness-110 disabled:opacity-50"
        >
          <FiMessageCircle className="shrink-0 text-[1.2rem]" />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.95rem] font-semibold">매칭 요청</span>
            <span className="mt-0.5 block text-[0.78rem] opacity-85">{baseLabel}</span>
          </span>
        </button>

        <button
          type="button"
          disabled={pending || !wallet || points < priorityCost}
          onClick={() => onConfirm(true)}
          className="mt-2.5 flex w-full items-center gap-3 rounded-[16px] border border-violet-400/40 bg-accent-tint px-4 py-3.5 text-left transition hover:bg-accent-tint-strong disabled:opacity-50"
        >
          <FiHeart className="shrink-0 fill-current text-[1.15rem] text-violet-300" />
          <span className="min-w-0 flex-1">
            <span className="block text-[0.95rem] font-semibold text-white">
              진심 요청 <span className="ml-1 text-[0.8rem] font-medium text-violet-300">+{PRICE.priorityRequest}P</span>
            </span>
            <span className="mt-0.5 block break-keep text-[0.78rem] text-zinc-400">
              상대 채팅 목록 맨 위에 💜 표시로 먼저 보여요 · 총 {priorityCost}P
            </span>
          </span>
        </button>

        <p className="mt-3 text-center text-[0.76rem] text-zinc-500">
          보유 {points.toLocaleString()}P · 받은 요청에 답하는 건 언제나 무료예요
        </p>

        {error && (
          <div className="alert-error mt-3 flex items-center justify-between gap-3">
            <span className="break-keep">{error}</span>
            {needsPoints && (
              <Link href="/points" className="shrink-0 font-semibold underline underline-offset-2">
                충전하기
              </Link>
            )}
          </div>
        )}
        {!error && wallet && points < baseCost && (
          <Link href="/points" className="mt-3 block text-center text-[0.84rem] font-semibold text-violet-300 underline underline-offset-2">
            신뢰 포인트 충전하러 가기
          </Link>
        )}
      </div>
    </div>
  );
}
