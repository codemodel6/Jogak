"use client";

import { FiLock, FiUser, FiX } from "react-icons/fi";

import { useFacePhotoUrlQuery } from "@/entities/profile/hooks";
import Skeleton from "@/shared/ui/skeleton";

type FaceDecisionModalProps = {
  partnerUserId: string;
  partnerName: string;
  partnerAvatar?: string;
  // requester: 요청한 내가 먼저 상대를 확인 / receiver: 상대가 확정한 뒤 내가 답함
  role: "requester" | "receiver";
  pending: boolean;
  onDecide: (proceed: boolean) => void;
  onClose: () => void;
};

// 매칭 확인 창: 상대의 실물 사진(없으면 프로필 아이콘, 그것도 없으면 기본 아이콘)을 보고 [매칭] / [거절]
export default function FaceDecisionModal({
  partnerUserId,
  partnerName,
  partnerAvatar,
  role,
  pending,
  onDecide,
  onClose,
}: FaceDecisionModalProps) {
  const faceQuery = useFacePhotoUrlQuery(partnerUserId);
  const faceUrl = faceQuery.data ?? null;
  const shown = faceUrl ?? partnerAvatar ?? null;

  return (
    // 바깥을 눌러도 닫히지 않는다. 닫기(X)로 미뤄 두고 매칭 영역의 버튼으로 다시 열 수 있다.
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${partnerName}님 사진 확인`}
        className="relative w-full overflow-hidden rounded-t-[26px] border border-white/10 bg-surface pb-[calc(20px+env(safe-area-inset-bottom))] shadow-2xl sm:max-w-[400px] sm:rounded-[26px] sm:pb-5"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="나중에"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
        >
          <FiX className="text-[1.1rem]" />
        </button>

        <div className="keep-dark relative aspect-[4/5] max-h-[56dvh] w-full bg-[linear-gradient(160deg,#241c46,#0b0a12)]">
          {faceQuery.isPending ? (
            <Skeleton className="h-full w-full" />
          ) : shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown}
              alt={`${partnerName}님 사진`}
              className={faceUrl ? "h-full w-full object-cover" : "mx-auto mt-[18%] h-40 w-40 rounded-full object-cover ring-4 ring-white/10"}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="flex h-40 w-40 items-center justify-center rounded-full bg-white/8 text-[4rem] text-white/50">
                <FiUser />
              </span>
            </div>
          )}
          <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[0.72rem] font-medium text-white backdrop-blur">
            <FiLock className="text-[0.75rem]" />
            {faceUrl ? "실물 사진 · 매칭 확인 때만 보여요" : "실물 사진을 등록하지 않은 분이에요"}
          </span>
        </div>

        <div className="px-5 pt-4">
          <h2 className="break-keep text-[1.15rem] font-semibold text-white">
            {role === "requester" ? `${partnerName}님과 매칭할까요?` : `${partnerName}님이 매칭을 원해요`}
          </h2>
          <p className="mt-1.5 break-keep text-[0.82rem] leading-5 text-zinc-400">
            {role === "requester"
              ? "매칭을 고르면 상대도 내 사진을 보고 답해요. 거절하면 상대는 내 사진을 보지 못하고 대화가 종료돼요."
              : "매칭하면 24시간 동안 서로의 위치를 볼 수 있어요. 거절하면 대화가 종료돼요."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => onDecide(false)}
              className="h-12 rounded-[14px] border border-white/10 text-[0.95rem] font-medium text-zinc-200 transition hover:bg-white/6 disabled:opacity-60"
            >
              거절
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => onDecide(true)}
              className="h-12 rounded-[14px] bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] text-[0.95rem] font-semibold text-on-accent transition hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "처리 중..." : "매칭"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
