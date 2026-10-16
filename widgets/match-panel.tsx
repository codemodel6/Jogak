"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiEye, FiHeart, FiLock, FiMapPin, FiNavigation } from "react-icons/fi";

import {
  useActiveMatchQuery,
  useCancelMatchMutation,
  useChatLocationsQuery,
  useConfirmMeetMutation,
  useContestPenaltyMutation,
  useDecideMatchRequestMutation,
  useMyPendingPenaltiesQuery,
  useReportNoShowMutation,
  useRequestMatchMutation,
  useRespondMatchMutation,
} from "@/entities/match/hooks";
import { useWalletQuery } from "@/entities/wallet/hooks";
import FaceDecisionModal from "@/features/match/face-decision-modal";
import MatchRequestSheet from "@/features/match/match-request-sheet";
import { distanceMeters, useLiveLocationSharing } from "@/features/match/use-live-location";
import ReviewModal from "@/features/review/review-modal";
import Skeleton from "@/shared/ui/skeleton";

type MatchPanelProps = {
  chatId: string;
  currentUserId: string;
  partnerUserId: string;
  partnerName: string;
  // 채팅·상대 정보에 보이는 프로필 아이콘 (실물 사진이 없을 때 확인 창에 대신 보여 준다)
  partnerAvatar?: string;
  // 매칭 거절로 닫힌 방이면 그 이유
  closedReason: string | null;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
};

const MATCH_DURATION_MS = 24 * 60 * 60 * 1000;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

// 남은 시간 표시: 1시간 이상이면 "H시간 M분", 그 아래는 "M:SS"
function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}시간 ${minutes}분`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDistance(meters: number) {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

function formatAgo(timestamp: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return "방금";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 전`;
  return `${Math.floor(seconds / 3600)}시간 전`;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  return now;
}

// 후기 모달을 "나중에"로 닫은 매칭은 다시 자동으로 띄우지 않는다(대화방의 '후기 남기기'로는 열 수 있다)
const reviewDismissKey = (matchId: string) => `review-dismissed:${matchId}`;

function isReviewDismissed(matchId: string) {
  try {
    return window.localStorage.getItem(reviewDismissKey(matchId)) === "1";
  } catch {
    return false;
  }
}

function dismissReview(matchId: string) {
  try {
    window.localStorage.setItem(reviewDismissKey(matchId), "1");
  } catch {
    // 저장소를 못 쓰면 다음에 다시 뜰 뿐이다
  }
}

// 대화방이 닫힌 사유별 안내 (chats.closed_reason)
function closedMessage(reason: string) {
  switch (reason) {
    case "declined":
      return "매칭이 거절되었습니다.";
    case "requester_rejected":
      return "매칭 요청이 취소되었습니다.";
    case "withdrawn":
      return "매치가 취소되었습니다.";
    case "reported":
      return "만나지 못해 매칭이 끝났습니다.";
    case "expired":
      return "매칭 시간이 끝났습니다.";
    default:
      return "매칭이 끝났습니다.";
  }
}

const primaryButton =
  "flex h-10 items-center justify-center gap-1.5 rounded-[12px] bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] px-4 text-[0.88rem] font-semibold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60";
const ghostButton =
  "flex h-10 items-center justify-center gap-1.5 rounded-[12px] border border-white/10 bg-white/5 px-4 text-[0.88rem] font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60";

// 1:1 채팅 상단의 매칭 영역: 요청 → 수락 → 매칭 중(실시간 위치, 만났어요/못 만났어요) → 감점 예정 조치
export default function MatchPanel({
  chatId,
  currentUserId,
  partnerUserId,
  partnerName,
  partnerAvatar,
  closedReason,
  onNotice,
  onError,
}: MatchPanelProps) {
  const matchQuery = useActiveMatchQuery(chatId);
  const penaltiesQuery = useMyPendingPenaltiesQuery(currentUserId || undefined);
  const match = matchQuery.data?.match ?? null;
  const isMatched = match?.status === "matched";
  const locationsQuery = useChatLocationsQuery(chatId, isMatched);
  const live = useLiveLocationSharing(chatId, isMatched);

  const requestMutation = useRequestMatchMutation(chatId);
  const respondMutation = useRespondMatchMutation(chatId);
  const cancelMutation = useCancelMatchMutation(chatId);
  const confirmMutation = useConfirmMeetMutation(chatId);
  const reportMutation = useReportNoShowMutation(chatId);
  const contestMutation = useContestPenaltyMutation(chatId);
  const decideMutation = useDecideMatchRequestMutation(chatId);
  const walletQuery = useWalletQuery();
  const [confirmingReport, setConfirmingReport] = useState(false);
  const [requestSheetOpen, setRequestSheetOpen] = useState(false);
  const [requestError, setRequestError] = useState<{ message: string; needsPoints: boolean } | null>(null);
  // 사진 확인 창을 '나중에'로 닫은 매칭 (매칭 영역 버튼으로 다시 연다)
  const [faceClosedFor, setFaceClosedFor] = useState<string | null>(null);
  const [faceOpenFor, setFaceOpenFor] = useState<string | null>(null);
  const [reviewOpenFor, setReviewOpenFor] = useState<string | null>(null);
  const [reviewClosedFor, setReviewClosedFor] = useState<string | null>(null);

  // 만남이 성사됐고 아직 후기를 안 남겼으면 후기 모달을 자동으로 띄운다
  const pendingReviewMatchId = match?.status === "met" && !matchQuery.data?.reviewed ? match.matchId : null;
  const reviewOpen =
    pendingReviewMatchId !== null &&
    (reviewOpenFor === pendingReviewMatchId ||
      (reviewClosedFor !== pendingReviewMatchId && !isReviewDismissed(pendingReviewMatchId)));

  const penalty = penaltiesQuery.data?.penalties.find((item) => item.chatId === chatId) ?? null;
  const now = useNow(isMatched || Boolean(penalty));
  const busy =
    requestMutation.isPending ||
    respondMutation.isPending ||
    cancelMutation.isPending ||
    confirmMutation.isPending ||
    reportMutation.isPending ||
    contestMutation.isPending ||
    decideMutation.isPending;

  const run = async (action: () => Promise<unknown>, message: string) => {
    try {
      await action();
      onNotice(message);
    } catch (err) {
      onError(err instanceof Error ? err.message : "요청 처리에 실패했습니다.");
    }
  };

  useEffect(() => {
    if (live.error) {
      onError(live.error);
    }
  }, [live.error, onError]);

  if (!currentUserId || matchQuery.isPending) {
    return <Skeleton className="h-[62px] rounded-[16px]" />;
  }

  // 나에게 걸린 감점 예정: 매칭 상태와 상관없이 가장 먼저 보여준다
  if (penalty) {
    const remaining = new Date(penalty.dueAt).getTime() - now;

    return (
      <div className="rounded-[16px] border border-rose-400/30 bg-rose-500/10 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <FiAlertTriangle className="mt-0.5 shrink-0 text-[1.1rem] text-rose-300" />
          <div className="min-w-0 flex-1">
            <p className="break-keep text-[0.92rem] font-semibold text-white">
              {penalty.reporterName}님이 &lsquo;못 만났어요&rsquo;를 눌렀어요
            </p>
            <p className="mt-1 break-keep text-[0.82rem] text-rose-100/85">
              <span className="font-semibold text-rose-200">{formatRemaining(remaining)}</span> 안에 조치하지 않으면 신뢰 점수가
              1점 깎여요.
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => contestMutation.mutateAsync(penalty.penaltyId), "만났다고 응답했어요. 점수는 깎이지 않아요.")}
            className={primaryButton}
          >
            만났어요
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => contestMutation.mutateAsync(penalty.penaltyId), "이의를 제기했어요. 점수는 깎이지 않아요.")}
            className={ghostButton}
          >
            이의 제기
          </button>
        </div>
      </div>
    );
  }

  if (match?.status === "met") {
    const reviewed = Boolean(matchQuery.data?.reviewed);
    const closeReview = () => {
      dismissReview(match.matchId);
      setReviewClosedFor(match.matchId);
      setReviewOpenFor(null);
    };

    return (
      <>
        <div className="flex items-center gap-3 rounded-[16px] border border-emerald-400/25 bg-emerald-500/8 px-4 py-3">
          <FiCheckCircle className="shrink-0 text-[1.15rem] text-emerald-300" />
          <div className="min-w-0 flex-1">
            <p className="break-keep text-[0.9rem] font-semibold text-white">{partnerName}님과 만남 완료</p>
            <p className="mt-0.5 break-keep text-[0.78rem] text-zinc-400">
              {reviewed ? "후기를 남겼어요. 고마워요!" : "신뢰 점수 +1점! 짧은 후기를 남겨 주세요."} 대화는 종료됐어요.
            </p>
          </div>
          {reviewed ? (
            <Link href="/notices?category=후기" className={cx(ghostButton, "shrink-0")}>
              후기 게시판
            </Link>
          ) : (
            <button type="button" onClick={() => setReviewOpenFor(match.matchId)} className={cx(primaryButton, "shrink-0")}>
              후기 남기기
            </button>
          )}
        </div>
        {reviewOpen && (
          <ReviewModal
            chatId={chatId}
            matchId={match.matchId}
            partnerName={partnerName}
            onClose={closeReview}
            onDone={() => {
              closeReview();
              onNotice("후기가 게시판 '후기'에 올라갔어요.");
            }}
          />
        )}
      </>
    );
  }

  if (closedReason) {
    return (
      <div className="flex items-center gap-3 rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3">
        <FiLock className="shrink-0 text-[1.1rem] text-zinc-400" />
        <p className="min-w-0 flex-1 break-keep text-[0.85rem] text-zinc-300">
          {closedMessage(closedReason)} 이 대화는 종료되어 더 이상 메시지를 보낼 수 없어요.
        </p>
      </div>
    );
  }

  if (!match) {
    const submitRequest = async (priority: boolean) => {
      try {
        await requestMutation.mutateAsync(priority);
        setRequestSheetOpen(false);
        onNotice(`${partnerName}님의 사진을 확인하고 매칭 여부를 골라 주세요.`);
      } catch (err) {
        setRequestError({
          message: err instanceof Error ? err.message : "매칭 요청에 실패했어요.",
          needsPoints: Boolean((err as { needsPoints?: boolean })?.needsPoints),
        });
      }
    };

    return (
      <>
        <div className="flex items-center gap-3 rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3">
          <FiHeart className="shrink-0 text-[1.1rem] text-violet-300" />
          <p className="min-w-0 flex-1 break-keep text-[0.85rem] text-zinc-300">
            마음이 맞았다면 매칭을 요청해 보세요. 요청하면 상대 실물 사진을 먼저 확인할 수 있어요.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setRequestError(null);
              setRequestSheetOpen(true);
            }}
            className={cx(primaryButton, "shrink-0")}
          >
            <FiHeart />
            매칭 요청
          </button>
        </div>
        {requestSheetOpen && (
          <MatchRequestSheet
            partnerName={partnerName}
            wallet={walletQuery.data}
            pending={requestMutation.isPending}
            error={requestError?.message ?? null}
            needsPoints={requestError?.needsPoints ?? false}
            onConfirm={(priority) => void submitRequest(priority)}
            onClose={() => setRequestSheetOpen(false)}
          />
        )}
      </>
    );
  }

  if (match.status === "requested") {
    const iRequested = match.requesterId === currentUserId;
    // 요청한 나: 확정 전이면 상대 사진을 보고 결정 / 받은 나: 상대가 확정한 뒤에 사진을 보고 답함
    const myTurn = iRequested ? !match.requesterConfirmed : match.requesterConfirmed;
    const faceOpen =
      myTurn && (faceOpenFor === match.matchId || faceClosedFor !== match.matchId);
    const closeFace = () => {
      setFaceClosedFor(match.matchId);
      setFaceOpenFor(null);
    };
    const decide = (proceed: boolean) =>
      void run(
        async () => {
          if (iRequested) {
            await decideMutation.mutateAsync({ matchId: match.matchId, proceed });
          } else {
            await respondMutation.mutateAsync({ matchId: match.matchId, accept: proceed });
          }
          setFaceOpenFor(null);
        },
        iRequested
          ? proceed
            ? `${partnerName}님에게 매칭 요청을 보냈어요. 답을 기다려 주세요.`
            : "매칭 요청을 취소했어요. 대화가 종료돼요."
          : proceed
            ? "매칭되었어요!"
            : "매칭을 거절했어요. 대화가 종료돼요.",
      );

    const faceModal = faceOpen && (
      <FaceDecisionModal
        partnerUserId={partnerUserId}
        partnerName={partnerName}
        partnerAvatar={partnerAvatar}
        role={iRequested ? "requester" : "receiver"}
        pending={busy}
        onDecide={decide}
        onClose={closeFace}
      />
    );

    if (myTurn) {
      return (
        <>
          <div className="rounded-[16px] border border-violet-400/35 bg-violet-500/12 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <FiHeart className="shrink-0 fill-current text-[1.1rem] text-violet-300" />
              <p className="min-w-0 flex-1 break-keep text-[0.92rem] font-semibold text-white">
                {iRequested ? `${partnerName}님의 사진을 확인해 주세요` : `${partnerName}님이 매칭을 원해요`}
              </p>
              <button type="button" onClick={() => setFaceOpenFor(match.matchId)} className={cx(primaryButton, "shrink-0")}>
                <FiEye />
                사진 보고 결정
              </button>
            </div>
          </div>
          {faceModal}
        </>
      );
    }

    return (
      <div className="flex items-center gap-3 rounded-[16px] border border-white/8 bg-white/[0.03] px-4 py-3">
        <FiClock className="shrink-0 text-[1.1rem] text-violet-300" />
        <p className="min-w-0 flex-1 break-keep text-[0.85rem] text-zinc-300">
          {iRequested
            ? `${partnerName}님이 내 사진을 보고 답하는 중이에요.`
            : `${partnerName}님이 매칭을 요청했어요. 상대가 확정하면 사진을 보고 답할 수 있어요.`}
        </p>
        {iRequested && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => cancelMutation.mutateAsync(match.matchId), "매칭 요청을 취소했어요. 대화가 종료돼요.")}
            className={cx(ghostButton, "shrink-0")}
          >
            요청 취소
          </button>
        )}
      </div>
    );
  }

  // 매칭 중
  const iAmRequester = match.requesterId === currentUserId;
  const iMet = iAmRequester ? match.requesterMet : match.receiverMet;
  const partnerMet = iAmRequester ? match.receiverMet : match.requesterMet;
  const remaining = match.matchedAt ? new Date(match.matchedAt).getTime() + MATCH_DURATION_MS - now : 0;
  const locations = locationsQuery.data?.locations ?? [];
  const myLocation = locations.find((item) => item.userId === currentUserId);
  const partnerLocation = locations.find((item) => item.userId !== currentUserId);
  const distance = myLocation && partnerLocation ? distanceMeters(myLocation, partnerLocation) : null;

  return (
    <div className="rounded-[16px] border border-violet-400/30 bg-accent-tint px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 rounded-full bg-violet-500/25 px-2.5 py-1 text-[0.78rem] font-semibold text-violet-100">
          <FiHeart className="fill-current" />
          매칭 중
        </span>
        <span className="flex items-center gap-1 text-[0.8rem] text-zinc-300">
          <FiClock />
          남은 시간 {formatRemaining(remaining)}
        </span>
      </div>

      {/* 실시간 위치 (지도는 지도 API 연결 후 이 자리에 들어간다) */}
      <div className="mt-3 rounded-[12px] border border-white/8 bg-black/20 px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[0.85rem] font-semibold text-white">
              <FiMapPin className="text-violet-300" />
              {locationsQuery.isPending ? (
                <Skeleton className="h-4 w-40 rounded-md" />
              ) : partnerLocation ? (
                `${partnerName}님 위치`
              ) : (
                `${partnerName}님이 아직 위치를 공유하지 않았어요`
              )}
            </div>
            {partnerLocation && (
              <p className="mt-0.5 text-[0.78rem] text-zinc-400">
                {distance !== null ? `나와 ${formatDistance(distance)} · ` : ""}
                {formatAgo(partnerLocation.updatedAt, now)} 갱신
              </p>
            )}
          </div>
          {partnerLocation && (
            <a
              href={`https://map.kakao.com/link/map/${encodeURIComponent(partnerName)},${partnerLocation.lat},${partnerLocation.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-[10px] bg-white/8 px-3 py-1.5 text-[0.78rem] font-medium text-zinc-100 transition hover:bg-white/14"
            >
              지도에서 보기
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={live.sharing ? live.stop : live.start}
          className={cx(
            "mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] text-[0.82rem] font-semibold transition",
            live.sharing
              ? "bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
              : "bg-violet-500/20 text-violet-100 hover:bg-violet-500/30",
          )}
        >
          <FiNavigation className={cx(live.sharing && "animate-pulse")} />
          {live.sharing ? "내 위치 실시간 공유 중 · 누르면 중지" : "내 위치 실시간 공유 시작"}
        </button>
      </div>

      {confirmingReport ? (
        <div className="mt-3 rounded-[12px] border border-rose-400/25 bg-rose-500/8 px-3.5 py-3">
          <p className="break-keep text-[0.82rem] text-rose-100">
            정말 못 만났나요? 매칭과 대화가 끝나고, {partnerName}님이 1시간 안에 조치하지 않으면 신뢰 점수가 1점 깎여요.
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirmingReport(false)} className={ghostButton}>
              취소
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirmingReport(false);
                void run(() => reportMutation.mutateAsync(match.matchId), `${partnerName}님에게 알림을 보냈어요.`);
              }}
              className="flex h-10 items-center justify-center rounded-[12px] bg-rose-500/80 px-4 text-[0.88rem] font-semibold text-white transition hover:bg-rose-500 disabled:opacity-60"
            >
              못 만났어요
            </button>
          </div>
        </div>
      ) : (
        <>
          {(iMet || partnerMet) && (
            <p className="mt-3 break-keep text-[0.8rem] text-violet-100/90">
              {iMet
                ? `${partnerName}님도 '만났어요'를 누르면 둘 다 신뢰 점수 +1점!`
                : `${partnerName}님이 만났다고 했어요. 나도 누르면 둘 다 +1점!`}
            </p>
          )}
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              disabled={busy || iMet}
              onClick={() =>
                void run(async () => {
                  const result = await confirmMutation.mutateAsync(match.matchId);
                  if (result === "met") {
                    live.stop();
                  }
                }, partnerMet ? "만남이 성사됐어요! 신뢰 점수 +1점" : "만났어요를 눌렀어요.")
              }
              className={primaryButton}
            >
              {iMet ? "상대 확인 대기 중" : "만났어요"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirmingReport(true)} className={ghostButton}>
              못 만났어요
            </button>
          </div>
        </>
      )}
    </div>
  );
}
