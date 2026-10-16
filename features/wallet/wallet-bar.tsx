"use client";

import Link from "next/link";
import { FiGift, FiPlus } from "react-icons/fi";

import type { Wallet } from "@/entities/wallet";
import Skeleton from "@/shared/ui/skeleton";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

// 매칭 화면 위: 오늘 남은 무료 매칭권 · 보너스 · 보유 포인트
export default function WalletBar({ wallet }: { wallet: Wallet | undefined }) {
  if (!wallet) {
    return <Skeleton className="h-[62px] w-full rounded-[18px]" />;
  }

  return (
    <section className="match-panel flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[0.86rem] font-semibold text-white">오늘 무료 매칭권</span>
          <span className="flex shrink-0 gap-1" aria-label={`${wallet.freeLeft}장 남음`}>
            {Array.from({ length: wallet.freeTotal }, (_, index) => (
              <span
                key={index}
                className={cx("h-2 w-5 rounded-full", index < wallet.freeLeft ? "bg-[#6f56ff]" : "bg-white/12")}
              />
            ))}
          </span>
          <span className="text-[0.86rem] font-semibold text-violet-300">
            {wallet.freeLeft}/{wallet.freeTotal}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[0.76rem] text-zinc-400">
          자정에 3장으로 다시 채워져요
          {wallet.bonusTickets > 0 && (
            <>
              {" · "}
              <FiGift className="mb-0.5 inline text-amber-300" /> 보너스 {wallet.bonusTickets}장
            </>
          )}
          {wallet.streak > 0 && ` · 연속 출석 ${wallet.streak}일`}
        </p>
      </div>
      <Link
        href="/points"
        className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[0.8rem] font-medium text-zinc-200 transition hover:bg-white/6"
      >
        {wallet.points.toLocaleString()}P
        <FiPlus className="text-violet-300" />
      </Link>
    </section>
  );
}
