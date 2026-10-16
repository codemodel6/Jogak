"use client";

import Link from "next/link";
import { FiGift, FiPlus, FiTag } from "react-icons/fi";

import type { Wallet } from "@/entities/wallet";
import Skeleton from "@/shared/ui/skeleton";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

// 매칭 화면 위: 오늘 남은 무료 매칭권 · 보너스 · 보유 포인트
export default function WalletBar({ wallet }: { wallet: Wallet | undefined }) {
  if (!wallet) {
    return <Skeleton className="h-[112px] w-full rounded-[18px]" />;
  }

  return (
    <section className="match-panel px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 whitespace-nowrap text-[0.9rem] font-semibold text-white">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/14 text-violet-300">
            <FiTag className="text-[0.85rem]" />
          </span>
          오늘 무료 매칭권
        </p>
        <p className="whitespace-nowrap text-[0.9rem] text-zinc-400">
          <b className="text-[1.15rem] font-semibold text-violet-300">{wallet.freeLeft}</b> / {wallet.freeTotal}장
        </p>
      </div>

      <div className="mt-3 flex gap-1.5" aria-label={`${wallet.freeLeft}장 남음`}>
        {Array.from({ length: wallet.freeTotal }, (_, index) => (
          <span
            key={index}
            className={cx("h-2 flex-1 rounded-full", index < wallet.freeLeft ? "bg-[#6f56ff]" : "bg-white/12")}
          />
        ))}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-0.5 break-keep text-[0.76rem] leading-5 text-zinc-400">
          <p>자정에 {wallet.freeTotal}장으로 다시 채워져요</p>
          {(wallet.bonusTickets > 0 || wallet.streak > 0) && (
            <p>
              {wallet.bonusTickets > 0 && (
                <>
                  <FiGift className="mb-0.5 inline text-amber-300" /> 보너스 {wallet.bonusTickets}장
                </>
              )}
              {wallet.bonusTickets > 0 && wallet.streak > 0 && " · "}
              {wallet.streak > 0 && `연속 출석 ${wallet.streak}일`}
            </p>
          )}
        </div>
        <Link
          href="/points"
          className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-white/10 px-3 py-1.5 text-[0.8rem] font-medium text-zinc-200 transition hover:bg-white/6"
        >
          {wallet.points.toLocaleString()}P
          <FiPlus className="text-violet-300" />
        </Link>
      </div>
    </section>
  );
}
