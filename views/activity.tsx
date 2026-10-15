"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiHeart,
  FiMessageCircle,
  FiMoreHorizontal,
  FiStar,
  FiUsers,
} from "react-icons/fi";

import type { ActivityType } from "@/entities/activity";
import { useMyActivityQuery } from "@/entities/activity/hooks";
import { useReviewsQuery } from "@/entities/review/hooks";
import { useAuthStatusQuery } from "@/features/auth/hooks";
import Skeleton from "@/shared/ui/skeleton";
import MainLayout from "@/widgets/main-layout";

const activityIcon: Record<ActivityType, { icon: ComponentType<{ className?: string }>; className: string }> = {
  매칭: { icon: FiHeart, className: "bg-emerald-500/16 text-emerald-300" },
  대화: { icon: FiMessageCircle, className: "bg-violet-500/16 text-violet-300" },
  후기: { icon: FiStar, className: "bg-amber-500/16 text-amber-300" },
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatShortDate(value: string) {
  const date = new Date(value);
  return `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${formatShortDate(value)}`;
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.max(1, minutes)}분`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}시간`;
  return `${Math.round(minutes / (60 * 24))}일`;
}

export default function ActivityPage() {
  const router = useRouter();
  const { data: isAuthenticated } = useAuthStatusQuery();
  const [filter, setFilter] = useState<ActivityType | "전체">("전체");
  const queryEnabled = isAuthenticated === true;
  const activityQuery = useMyActivityQuery(queryEnabled);
  const reviewsQuery = useReviewsQuery("received", queryEnabled);
  // 서버 화면과 브라우저 첫 화면을 같게(스켈레톤) 그린다
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  const activity = activityQuery.data;
  const loading = !mounted || !queryEnabled || activityQuery.isPending;
  const reviewsLoading = !mounted || !queryEnabled || reviewsQuery.isPending;
  const recentReviews = (reviewsQuery.data?.reviews ?? []).slice(0, 3);
  const filtered = (activity?.items ?? []).filter((item) => filter === "전체" || item.type === filter);
  const monthlyMatches = activity?.monthly ?? [];
  const maxMonthly = Math.max(1, ...monthlyMatches.map((item) => item.count));
  const summary: Array<{
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: string;
    change: string;
    accentClassName: string;
  }> = activity
    ? [
        { icon: FiUsers, label: "매칭 성공", value: `${activity.metCount}건`, change: `이번 달 +${activity.metThisMonth}`, accentClassName: "text-violet-400" },
        { icon: FiMessageCircle, label: "받은 후기", value: `${activity.reviewCount}개`, change: `이번 달 +${activity.reviewThisMonth}`, accentClassName: "text-violet-400" },
        {
          icon: FiMoreHorizontal,
          label: "응답률",
          value: activity.responseRate === null ? "-" : `${activity.responseRate}%`,
          change: `받은 요청 ${activity.receivedRequests}건`,
          accentClassName: "text-indigo-400",
        },
        {
          icon: FiStar,
          label: "평균 평점",
          value: activity.averageRating === null ? "-" : activity.averageRating.toFixed(1),
          change: "5점 만점",
          accentClassName: "text-amber-400",
        },
      ]
    : [];

  return (
    <MainLayout active="profile" title="내 활동" copy="매칭과 대화, 받은 후기를 한눈에 확인하세요.">
      <Link
        href="/profile"
        className="mt-4 inline-flex items-center gap-1.5 text-[0.88rem] text-zinc-300 transition hover:text-white"
      >
        <FiChevronLeft />
        내 정보로
      </Link>

      <div className="mt-3 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <main className="flex min-w-0 flex-col gap-5">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {loading &&
              Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-[132px] rounded-[18px]" />)}
            {summary.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.label} className="surface-panel-soft px-3 py-4 text-center">
                  <Icon className={cx("mx-auto text-[1.35rem]", item.accentClassName)} />
                  <p className="mt-2 text-[0.86rem] text-zinc-300">{item.label}</p>
                  <p className="mt-2 text-[1.45rem] font-semibold leading-none tracking-[-0.04em] text-white">
                    {item.value}
                  </p>
                  <p className="mt-2 text-[0.76rem] text-emerald-300">{item.change}</p>
                </div>
              );
            })}
          </section>

          <section className="desktop-panel px-5 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.1rem] font-semibold text-white">받은 후기</h2>
              <Link href="/reviews?tab=received" className="flex items-center gap-1 text-[0.86rem] font-medium text-violet-300 hover:text-violet-200">
                전체 보기
                <FiChevronRight />
              </Link>
            </div>
            <div className="mt-4 divide-y divide-white/7">
              {reviewsLoading &&
                Array.from({ length: 2 }, (_, index) => (
                  <div key={index} className="space-y-2 py-3 first:pt-0 last:pb-0">
                    <Skeleton className="h-4 w-40 rounded-md" />
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                  </div>
                ))}
              {!reviewsLoading && recentReviews.length === 0 && (
                <p className="text-[0.86rem] text-zinc-400">아직 받은 후기가 없어요.</p>
              )}
              {!reviewsLoading && recentReviews.map((review) => (
                <div key={review.reviewId} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 text-[0.84rem]">
                    <span className="font-medium text-white">{review.reviewer.name}</span>
                    <span className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }, (_, index) => (
                        <FiStar key={index} className={index < review.rating ? "fill-current" : "text-zinc-600"} />
                      ))}
                    </span>
                    <span className="text-zinc-500">{formatDate(review.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 break-keep text-[0.9rem] leading-6 text-zinc-200">
                    {review.content || review.tags.join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="desktop-panel px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[1.1rem] font-semibold text-white">나의 최근 활동</h2>
              <div className="flex gap-1.5">
                {(["전체", "매칭", "대화", "후기"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={cx(
                      "rounded-full border px-3.5 py-1.5 text-[0.8rem] font-medium transition",
                      filter === item
                        ? "border-violet-400/60 bg-violet-500/25 text-white"
                        : "border-white/8 bg-white/4 text-zinc-300 hover:border-white/20",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 divide-y divide-white/7">
              {loading &&
                Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="flex gap-3.5 py-3 first:pt-0 last:pb-0">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48 rounded-md" />
                      <Skeleton className="h-3 w-32 rounded-md" />
                    </div>
                  </div>
                ))}
              {!loading && filtered.length === 0 && (
                <p className="text-[0.86rem] text-zinc-400">아직 활동 기록이 없어요.</p>
              )}
              {!loading && filtered.map((item) => {
                const { icon: Icon, className } = activityIcon[item.type];

                return (
                  <Link
                    key={item.id}
                    href={item.href ?? "#"}
                    className="flex items-start justify-between gap-4 py-3 transition first:pt-0 last:pb-0 hover:opacity-85"
                  >
                    <div className="flex min-w-0 gap-3.5">
                      <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", className)}>
                        <Icon className="text-[1rem]" />
                      </div>
                      <div className="min-w-0">
                        <p className="break-keep text-[0.95rem] font-medium text-white">{item.title}</p>
                        <p className="mt-1 line-clamp-1 text-[0.84rem] text-zinc-400">{item.description}</p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[0.84rem] text-zinc-500">{formatShortDate(item.at)}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        </main>

        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-5">
          <section className="desktop-side-panel px-5 py-5">
            <h3 className="text-[1rem] font-semibold text-white">월별 매칭 성공</h3>
            {loading && <Skeleton className="mt-5 h-32 rounded-[12px]" />}
            <div className={cx("mt-5 flex h-32 items-end justify-between gap-2", loading && "hidden")}>
              {monthlyMatches.map((item, index) => (
                <div key={item.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[0.72rem] text-zinc-400">{item.count}</span>
                  <div
                    className={cx(
                      "w-full max-w-7 rounded-t-[6px]",
                      index === monthlyMatches.length - 1
                        ? "bg-[linear-gradient(180deg,#8b6cff,#5a38ea)]"
                        : "bg-white/12",
                    )}
                    style={{ height: `${(item.count / maxMonthly) * 88}px` }}
                  />
                  <span className="text-[0.72rem] text-zinc-500">{item.month}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="desktop-side-panel px-5 py-5">
            <h3 className="text-[1rem] font-semibold text-white">응답률</h3>
            {loading || !activity ? (
              <Skeleton className="mt-3 h-20 rounded-[12px]" />
            ) : activity.responseRate === null ? (
              <p className="mt-3 break-keep text-[0.84rem] text-zinc-400">아직 받은 대화 요청이 없어요.</p>
            ) : (
              <>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-[2rem] font-semibold leading-none tracking-[-0.05em] text-white">
                    {activity.responseRate}%
                  </p>
                  {activity.averageResponseMinutes !== null && (
                    <p className="flex items-center gap-1.5 text-[0.82rem] text-zinc-400">
                      <FiClock />
                      평균 응답 {formatMinutes(activity.averageResponseMinutes)}
                    </p>
                  )}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#7d55ff,#8156f4,#5940d8)]"
                    style={{ width: `${activity.responseRate}%` }}
                  />
                </div>
                <p className="mt-3 flex items-center gap-1.5 break-keep text-[0.8rem] text-zinc-400">
                  <FiMessageCircle className="shrink-0" />
                  받은 대화 요청 {activity.receivedRequests}건 중 {activity.answeredRequests}건에 답장했어요.
                </p>
              </>
            )}
          </section>
        </aside>
      </div>
    </MainLayout>
  );
}
