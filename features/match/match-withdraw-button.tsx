"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import * as api from "@/entities/match/api";
import { useWithdrawMatchMutation } from "@/entities/match/hooks";
import { matchKeys } from "@/entities/match/query-keys";

type MatchWithdrawButtonProps = {
  chatId: string;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

const REASONS = ["일정이 맞지 않아요", "마음이 바뀌었어요", "대화가 불편했어요", "연락이 되지 않아요"];
const OTHER = "기타";

// 채팅방 머리글의 매치 취소. 매칭 중일 때만 보이고, 사유를 고른 뒤 한 번 더 확인하면 내 신뢰 점수 1점을 깎는다.
// 사유는 대화방 맨 아래 시스템 메시지로 남는다. 매칭 상태는 매칭 영역(MatchPanel)이 구독하는 캐시를 같이 읽는다.
export default function MatchWithdrawButton({ chatId, onNotice, onError }: MatchWithdrawButtonProps) {
  const matchQuery = useQuery({
    queryKey: matchKeys.active(chatId),
    queryFn: () => api.getActiveMatch(chatId),
    enabled: Boolean(chatId),
  });
  const withdrawMutation = useWithdrawMatchMutation(chatId);
  const [confirming, setConfirming] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [otherText, setOtherText] = useState("");

  const match = matchQuery.data?.match ?? null;
  if (match?.status !== "matched") {
    return null;
  }

  const reason = choice === OTHER ? otherText.trim() : choice;

  const open = () => {
    setChoice(null);
    setOtherText("");
    setConfirming(true);
  };

  const withdraw = async () => {
    if (!reason) {
      return;
    }
    try {
      await withdrawMutation.mutateAsync({ matchId: match.matchId, reason });
      setConfirming(false);
      onNotice("매치를 취소했어요. 신뢰 점수 -1점");
    } catch (err) {
      setConfirming(false);
      onError(err instanceof Error ? err.message : "매치를 취소하지 못했어요.");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="shrink-0 rounded-[8px] border border-rose-500/60 px-2.5 py-1 text-[0.74rem] font-semibold text-rose-300 transition hover:bg-rose-500/10"
      >
        매치 취소
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 px-5"
          onClick={() => !withdrawMutation.isPending && setConfirming(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90dvh] w-full max-w-[360px] overflow-y-auto rounded-[16px] border-2 border-rose-500/60 bg-surface px-5 py-4.5"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[1rem] font-semibold text-white">매치를 취소하실 건가요?</p>
            <p className="mt-1.5 break-keep text-[0.85rem] text-zinc-300">
              매칭이 끝나고 <b className="text-rose-300">내 신뢰 점수가 1점</b> 깎여요. 이 대화도 종료돼요.
            </p>
            <p className="mt-4 text-[0.82rem] font-semibold text-zinc-200">취소 사유</p>
            <div className="mt-2 flex flex-col gap-1.5">
              {[...REASONS, OTHER].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setChoice(item)}
                  className={
                    choice === item
                      ? "rounded-[10px] border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-left text-[0.85rem] font-medium text-rose-200"
                      : "rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[0.85rem] text-zinc-300 transition hover:bg-white/[0.06]"
                  }
                >
                  {item}
                </button>
              ))}
              {choice === OTHER && (
                <input
                  value={otherText}
                  onChange={(event) => setOtherText(event.target.value)}
                  maxLength={100}
                  autoFocus
                  placeholder="사유를 적어 주세요"
                  className="rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2 text-[0.85rem] text-white placeholder:text-zinc-500 focus:border-rose-500/60 focus:outline-none"
                />
              )}
            </div>
            <p className="mt-2 text-[0.74rem] text-zinc-500">사유는 대화방에 표시돼 상대도 볼 수 있어요.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex h-10 items-center justify-center rounded-[12px] border border-white/10 bg-white/5 px-4 text-[0.88rem] font-medium text-zinc-200 transition hover:bg-white/10"
              >
                아니요
              </button>
              <button
                type="button"
                disabled={withdrawMutation.isPending || !reason}
                onClick={() => void withdraw()}
                className="flex h-10 items-center justify-center rounded-[12px] bg-rose-500/80 px-4 text-[0.88rem] font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
              >
                매치 취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
