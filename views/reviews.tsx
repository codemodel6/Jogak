"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { FiChevronLeft, FiStar } from "react-icons/fi";

import type { Review, ReviewScope } from "@/entities/review";
import { useReviewsQuery } from "@/entities/review/hooks";
import { useAuthStatusQuery } from "@/features/auth/hooks";
import Skeleton from "@/shared/ui/skeleton";
import MainLayout from "@/widgets/main-layout";

const PAGE_SIZE = 10;
// 나의 후기: 내가 받은 후기와 내가 쓴 후기. 모든 사람의 후기는 게시판 '후기' 분류에서 본다.
type MyReviewScope = Exclude<ReviewScope, "all">;
const TABS: Array<{ key: MyReviewScope; label: string }> = [
  { key: "received", label: "받은 후기" },
  { key: "written", label: "내가 쓴 후기" },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDate(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cx("flex items-center gap-0.5", className)} aria-label={`별점 ${rating}점`}>
      {Array.from({ length: 5 }, (_, index) => (
        <FiStar
          key={index}
          className={index < rating ? "fill-current text-amber-400" : "text-zinc-600"}
        />
      ))}
    </span>
  );
}

function Avatar({ name, photo }: { name: string; photo?: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[linear-gradient(135deg,#39466b,#182033)] text-[0.9rem] font-semibold text-zinc-200">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 1)
      )}
    </div>
  );
}

function summarize(reviews: Review[]) {
  const total = reviews.length;
  const average = total ? reviews.reduce((sum, review) => sum + review.rating, 0) / total : 0;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((review) => review.rating === star).length,
  }));
  const tagCounts = new Map<string, number>();
  for (const review of reviews) {
    for (const tag of review.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({ label, count }));

  return { total, average, distribution, topTags };
}

export default function ReviewsPage({ initialTab = "received" }: { initialTab?: MyReviewScope }) {
  const router = useRouter();
  const { data: isAuthenticated } = useAuthStatusQuery();
  const [tab, setTab] = useState<MyReviewScope>(initialTab);
  const [sort, setSort] = useState<"latest" | "rating">("latest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const reviewsQuery = useReviewsQuery(tab, isAuthenticated === true);
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

  const reviews = reviewsQuery.data?.reviews ?? [];
  const loading = !mounted || isAuthenticated !== true || reviewsQuery.isPending;
  const summary = summarize(reviews);
  const sorted = [...reviews].sort((a, b) =>
    sort === "latest"
      ? b.createdAt.localeCompare(a.createdAt)
      : b.rating - a.rating || b.createdAt.localeCompare(a.createdAt),
  );
  const visible = sorted.slice(0, visibleCount);
  const maxCount = Math.max(1, ...summary.distribution.map((item) => item.count));

  const changeTab = (next: MyReviewScope) => {
    setTab(next);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <MainLayout active="profile" title="나의 후기" copy="내가 받은 후기와 내가 쓴 후기를 모아 봤어요.">
      <Link
        href="/profile"
        className="mt-4 inline-flex items-center gap-1.5 text-[0.88rem] text-zinc-300 transition hover:text-white"
      >
        <FiChevronLeft />
        내 정보로
      </Link>
      <div className="mt-4 flex gap-1 rounded-[14px] border border-white/8 bg-white/3 p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => changeTab(item.key)}
            className={cx(
              "h-10 flex-1 rounded-[11px] text-[0.9rem] font-medium transition",
              tab === item.key ? "bg-violet-500/30 text-white" : "text-zinc-400 hover:text-zinc-200",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        {/* 요약: PC에서는 오른쪽에 고정, 모바일에서는 맨 위 */}
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-5 xl:col-start-2 xl:row-start-1">
          <section className="desktop-side-panel px-5 py-5">
            <p className="text-[0.82rem] text-zinc-400">{tab === "received" ? "받은 평균 별점" : "내가 준 평균 별점"}</p>
            {loading ? (
              <Skeleton className="mt-2 h-20 rounded-[12px]" />
            ) : (
              <div className="mt-2 flex items-center gap-4">
                <div>
                  <p className="text-[2.6rem] font-semibold leading-none tracking-[-0.05em] text-white">
                    {summary.total ? summary.average.toFixed(1) : "-"}
                  </p>
                  <Stars rating={Math.round(summary.average)} className="mt-2 text-[0.95rem]" />
                  <p className="mt-1.5 text-[0.82rem] text-zinc-400">후기 {summary.total}개</p>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {summary.distribution.map((item) => (
                    <div key={item.star} className="flex items-center gap-2 text-[0.78rem] text-zinc-400">
                      <span className="w-3 text-right">{item.star}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{ width: `${(item.count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="w-4 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {!loading && summary.topTags.length > 0 && (
            <section className="desktop-side-panel px-5 py-5">
              <h3 className="text-[1rem] font-semibold text-white">
                {tab === "received" ? "많이 받은 칭찬" : "많이 남긴 칭찬"}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {summary.topTags.map((tag) => (
                  <span
                    key={tag.label}
                    className="rounded-full border border-white/8 bg-white/4 px-3 py-1.5 text-[0.8rem] text-zinc-200"
                  >
                    {tag.label} <span className="font-semibold text-violet-300">{tag.count}</span>
                  </span>
                ))}
              </div>
            </section>
          )}
        </aside>

        <main className="flex min-w-0 flex-col gap-3 xl:col-start-1 xl:row-start-1">
          <div className="flex items-center justify-between">
            <p className="text-[0.9rem] text-zinc-300">
              전체 <span className="font-semibold text-white">{loading ? "-" : summary.total}</span>개
            </p>
            <div className="flex gap-1.5">
              {(
                [
                  { key: "latest", label: "최신순" },
                  { key: "rating", label: "별점순" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSort(item.key)}
                  className={cx(
                    "rounded-full border px-3.5 py-1.5 text-[0.82rem] font-medium transition",
                    sort === item.key
                      ? "border-violet-400/60 bg-violet-500/25 text-white"
                      : "border-white/8 bg-white/4 text-zinc-300 hover:border-white/20",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {loading &&
            Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="desktop-panel px-4 py-4 md:px-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-3 w-24 rounded-md" />
                  </div>
                </div>
                <Skeleton className="mt-3 h-4 w-3/4 rounded-md" />
                <Skeleton className="mt-3 h-6 w-40 rounded-full" />
              </div>
            ))}

          {!loading && reviewsQuery.isError && (
            <div className="alert-error">후기를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.</div>
          )}

          {!loading && !reviewsQuery.isError && reviews.length === 0 && (
            <div className="desktop-panel px-5 py-10 text-center">
              <p className="text-[0.95rem] font-medium text-white">
                {tab === "received" ? "아직 받은 후기가 없어요" : "아직 쓴 후기가 없어요"}
              </p>
              <p className="mt-1.5 break-keep text-[0.84rem] text-zinc-400">
                매칭 후 두 사람 모두 &lsquo;만났어요&rsquo;를 누르면 후기를 남길 수 있어요.
              </p>
            </div>
          )}

          {!loading &&
            visible.map((review) => (
              <article key={review.reviewId} className="desktop-panel px-4 py-4 md:px-5">
                <div className="flex items-center gap-3">
                  {/* 받은 후기는 쓴 사람(이름 일부 가림), 내가 쓴 후기는 받은 사람을 보여준다 */}
                  {tab === "received" ? (
                    <Avatar name={review.reviewer.name} photo={review.reviewer.photo} />
                  ) : (
                    <Avatar name={review.reviewee.name} photo={review.reviewee.photo} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.95rem] font-medium text-white">
                      {tab === "received" ? review.reviewer.name : review.reviewee.name}
                      <span className="ml-1 text-[0.82rem] font-normal text-zinc-400">
                        {tab === "received" ? "님이 남긴 후기" : "님에게 남긴 후기"}
                      </span>
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Stars rating={review.rating} className="text-[0.78rem]" />
                      <span className="text-[0.76rem] text-zinc-500">{formatDate(review.createdAt)}</span>
                    </div>
                  </div>
                </div>
                {review.content && (
                  <p className="mt-3 break-keep text-[0.93rem] leading-7 text-zinc-200">{review.content}</p>
                )}
                {review.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {review.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-violet-500/12 px-2.5 py-1 text-[0.76rem] text-violet-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}

          {!loading && visibleCount < sorted.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              className="rounded-[14px] border border-white/10 py-3 text-[0.9rem] font-medium text-white transition hover:bg-white/6"
            >
              후기 더보기 ({sorted.length - visibleCount})
            </button>
          )}
        </main>
      </div>
    </MainLayout>
  );
}
