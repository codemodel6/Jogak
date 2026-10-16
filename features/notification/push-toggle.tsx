"use client";

import { useEffect, useState } from "react";
import { FiBellOff, FiSmartphone } from "react-icons/fi";

import { disablePush, enablePush, getPushStatus, type PushStatus } from "@/shared/lib/push/push";

const STATUS_COPY: Record<PushStatus, string> = {
  on: "이 기기의 알림창으로 알림을 받고 있어요.",
  off: "켜면 앱을 닫아도 휴대폰·PC 알림창으로 알려 드려요.",
  denied: "브라우저에서 알림이 차단돼 있어요. 브라우저(또는 휴대폰) 설정 > 알림에서 조각을 허용해 주세요.",
  "needs-install": "아이폰은 사파리 공유 버튼 > '홈 화면에 추가'로 설치한 앱에서만 알림을 받을 수 있어요.",
  unsupported: "이 브라우저는 알림창 알림을 지원하지 않아요. 크롬·사파리 최신 버전에서 열어 주세요.",
};

// 설정 화면: 이 기기(브라우저·홈 화면 앱)에서 알림창 알림 받기
export default function PushToggle() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getPushStatus().then(setStatus);
  }, []);

  const toggle = async () => {
    setPending(true);
    setError(null);
    try {
      if (status === "on") {
        await disablePush();
        setStatus("off");
      } else {
        setStatus(await enablePush());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "알림 설정에 실패했어요.");
    } finally {
      setPending(false);
    }
  };

  const canToggle = status === "on" || status === "off";

  return (
    <div className="py-3.5">
      <div className="flex items-center justify-between gap-4">
        <span className="flex min-w-0 items-start gap-3">
          {status === "on" ? (
            <FiSmartphone className="mt-0.5 shrink-0 text-[1.1rem] text-violet-300" />
          ) : (
            <FiBellOff className="mt-0.5 shrink-0 text-[1.1rem] text-zinc-500" />
          )}
          <span className="min-w-0">
            <span className="block text-[0.95rem] text-zinc-100">이 기기 알림창으로 받기</span>
            <span className="mt-0.5 block break-keep text-[0.8rem] text-zinc-500">
              {status ? STATUS_COPY[status] : "확인 중..."}
            </span>
          </span>
        </span>
        {canToggle && (
          <button
            type="button"
            onClick={() => void toggle()}
            disabled={pending}
            className={
              status === "on"
                ? "h-9 shrink-0 rounded-[10px] border border-white/10 px-3.5 text-[0.82rem] font-medium text-zinc-300 transition hover:bg-white/6 disabled:opacity-60"
                : "h-9 shrink-0 rounded-[10px] bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] px-3.5 text-[0.82rem] font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-60"
            }
          >
            {pending ? "처리 중..." : status === "on" ? "끄기" : "켜기"}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-[0.8rem] text-rose-300">{error}</p>}
    </div>
  );
}
