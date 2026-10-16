"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  FiChevronRight,
  FiHeart,
  FiShield,
  FiStar,
  FiUsers,
} from "react-icons/fi";

import { useMatchStatsQuery } from "@/entities/chat/hooks";
import { isBoosted, type Post } from "@/entities/post";
import { usePostsQuery } from "@/entities/post/hooks";
import { useProfileQuery } from "@/entities/profile/hooks";
import { useWalletQuery } from "@/entities/wallet/hooks";
import { useAuthStatusQuery } from "@/features/auth/hooks";
import WalletBar from "@/features/wallet/wallet-bar";
import { useOnlineUserIds } from "@/shared/lib/presence/online-users";
import Skeleton from "@/shared/ui/skeleton";
import HomeBanner from "@/widgets/home-banner";
import MainLayout from "@/widgets/main-layout";

const CARD_COUNT = 10;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function HomePage() {
  const router = useRouter();
  const { data: isAuthenticated } = useAuthStatusQuery();
  const queryEnabled = isAuthenticated === true;
  const postsQuery = usePostsQuery(queryEnabled);
  const profileQuery = useProfileQuery(queryEnabled);
  const matchStatsQuery = useMatchStatsQuery(queryEnabled);
  const walletQuery = useWalletQuery(queryEnabled);

  const posts: Post[] = postsQuery.data?.posts ?? [];
  const profile = profileQuery.data?.profile;
  const onlineIds = useOnlineUserIds(profile?.userId);
  // 서버 화면과 브라우저 첫 화면을 같게(스켈레톤) 그린다
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    } else if (profile && !profile.onboarded) {
      router.replace("/onboarding");
    }
  }, [isAuthenticated, profile, router]);
  const currentUserId = profile?.userId ?? "";
  const postsLoading = !mounted || isAuthenticated !== true || postsQuery.isPending;
  const profileLoading = !mounted || isAuthenticated !== true || profileQuery.isPending;
  const queryError = postsQuery.error ?? profileQuery.error;
  const error =
    (queryError instanceof Error
      ? queryError.message
      : queryError
        ? "데이터를 불러오지 못했습니다."
        : null);

  // 다른 사람이 올린 매칭 글(최신순). 상단 노출(2P) 글이 맨 앞, 그다음 지금 접속 중인 사람의 글.
  const availablePosts = posts
    .filter((post) => post.userId && post.userId !== currentUserId)
    .map((post, order) => ({ post, order, online: onlineIds.includes(post.userId), boosted: isBoosted(post) }))
    .sort((a, b) => Number(b.boosted) - Number(a.boosted) || Number(b.online) - Number(a.online) || a.order - b.order);
  const cardPosts = availablePosts.slice(0, CARD_COUNT);

  const matchStats = matchStatsQuery.data;
  const formatCount = (value: number | undefined, unit: string) =>
    value === undefined ? null : `${value.toLocaleString("ko-KR")}${unit}`;
  const stats = [
    { icon: FiUsers, label: "현재 접속 중", value: formatCount(onlineIds.length || undefined, "명"), color: "text-violet-400" },
    { icon: FiHeart, label: "오늘 매칭 성공", value: formatCount(matchStats?.todayMatched, "건"), color: "text-violet-400" },
    { icon: FiStar, label: "누적 매칭 성공", value: formatCount(matchStats?.totalMatched, "건"), color: "text-amber-400" },
  ];

  return (
    <MainLayout active="home" title="홈" copy="신뢰 기반 실시간 만남" mobileTitle="조각">
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
          {/* 보조 단: PC에서는 오른쪽에 고정, 모바일에서는 본문 맨 위 */}
          <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-5 xl:col-start-2 xl:row-start-1">
            <section className="keep-dark rounded-[22px] bg-[linear-gradient(135deg,rgba(87,60,216,0.92),rgba(25,20,74,0.94))] px-5 py-5 shadow-[0_22px_42px_rgba(29,20,84,0.3)]">
              <p className="text-[0.92rem] font-medium text-white/80">내 신뢰 포인트</p>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#5660ff,#5b4eff)]">
                  <FiShield className="text-[1.6rem] text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  {profileLoading ? (
                    <Skeleton className="h-[1.9rem] w-20 rounded-md" />
                  ) : (
                    <p className="text-[1.9rem] font-semibold leading-none tracking-[-0.04em] text-white">
                      {(profile?.hearts ?? 0).toLocaleString()}
                    </p>
                  )}
                  <p className="mt-1.5 truncate text-[0.82rem] text-white/80">신뢰가 좋은 만남을 만들어요</p>
                </div>
              </div>
              <Link
                href="/points"
                className="mt-4 block w-full rounded-[14px] bg-[rgba(255,255,255,0.12)] px-4 py-2.5 text-center text-[0.86rem] font-medium text-white transition hover:bg-[rgba(255,255,255,0.18)]"
              >
                포인트 내역
              </Link>
            </section>

            {/* 오늘 남은 무료 매칭권 (매칭 화면과 같은 줄) */}
            <WalletBar wallet={mounted ? walletQuery.data : undefined} />
          </aside>

          <main className="flex min-w-0 flex-col gap-5 xl:col-start-1 xl:row-start-1">
            <HomeBanner />

            <section>
              <div className="flex items-center justify-between">
                <h2 className="text-[1.25rem] font-semibold tracking-[-0.03em] text-white md:text-[1.35rem]">
                  실시간 매칭 카드
                  {!postsLoading && availablePosts.length > 0 && (
                    <span className="ml-2 text-[0.9rem] font-medium text-violet-300">{availablePosts.length}</span>
                  )}
                </h2>
                <Link
                  href="/matching"
                  className="flex items-center gap-0.5 text-[0.86rem] font-medium text-zinc-300 transition hover:text-white"
                >
                  전체 보기
                  <FiChevronRight />
                </Link>
              </div>
              {/* 옆으로 밀어서(가로 스크롤) 더 본다. 배너처럼 화살표로 넘기지 않는다. */}
              <div className="-mx-1 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {postsLoading &&
                  Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-[184px] w-[42%] shrink-0 rounded-[18px] sm:w-[calc(25%-9px)]" />
                  ))}
                {!postsLoading && cardPosts.length === 0 && (
                  <p className="w-full py-6 text-center text-[0.85rem] text-zinc-400">표시할 매칭 글이 없어요.</p>
                )}
                {!postsLoading &&
                  cardPosts.map(({ post, online, boosted }, index) => (
                    <Link
                      key={`${post.postId}-${index}`}
                      href="/matching"
                      className={`relative w-[42%] shrink-0 snap-start rounded-[18px] border bg-surface px-3 py-4 text-center transition hover:border-violet-400/40 sm:w-[calc(25%-9px)] ${boosted ? "border-violet-400/50" : "border-white/8"}`}
                    >
                      {boosted && (
                        <span className="absolute left-2 top-2 rounded-md bg-[linear-gradient(135deg,#f59e0b,#ef4444)] px-1.5 py-[1px] text-[0.6rem] font-bold tracking-wide text-on-accent">
                          UP
                        </span>
                      )}
                      <div className="mx-auto flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[linear-gradient(135deg,var(--avatar-from),var(--avatar-to))] text-[1rem] font-semibold text-zinc-200 md:h-16 md:w-16">
                        {post.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt="" src={post.coverUrl} className="h-full w-full object-cover" />
                        ) : (
                          post.userName.slice(0, 1)
                        )}
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <p className="line-clamp-1 text-[0.88rem] font-medium text-white">{post.userName}</p>
                          {online && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />}
                        </div>
                        <p className="mt-1.5 line-clamp-2 break-keep text-[0.78rem] text-zinc-300">{post.title}</p>
                        {post.tags.length > 0 && (
                          <p className="mt-1.5 line-clamp-1 text-[0.76rem] text-zinc-400">
                            {post.tags.map((tag) => `#${tag}`).join(" ")}
                          </p>
                        )}
                      </div>
                      {online && (
                        <div className="mt-3 inline-flex rounded-full bg-[linear-gradient(135deg,#5f47ee,#4933c7)] px-3 py-1.5 text-[0.7rem] font-medium text-on-accent">
                          ONLINE
                        </div>
                      )}
                    </Link>
                  ))}
              </div>
            </section>

            <section className="grid grid-cols-3 gap-2.5 md:gap-3">
              {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <div
                    key={stat.label}
                    className="rounded-[18px] border border-white/7 bg-[linear-gradient(180deg,var(--surface),var(--surface-end))] px-2 py-4 text-center md:py-5"
                  >
                    <Icon className={cx("mx-auto text-[1.35rem] md:text-[1.55rem]", stat.color)} />
                    <p className="home-meta-text mt-2.5 text-zinc-300">{stat.label}</p>
                    {stat.value === null ? (
                      <Skeleton className="mx-auto mt-2 h-4 w-12 rounded-md" />
                    ) : (
                      <p className="mt-1.5 text-[0.95rem] font-semibold text-white md:text-[1.05rem]">{stat.value}</p>
                    )}
                  </div>
                );
              })}
            </section>

            <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-1 text-[0.8rem] text-zinc-500">
              <p>© 2024 조각. All rights reserved.</p>
              <div className="flex gap-5">
                <span>이용약관</span>
                <span>개인정보처리방침</span>
                <span>고객센터</span>
              </div>
            </footer>
          </main>
        </div>

      {error && (
        <div className="fixed right-4 top-4 z-50 rounded-2xl border border-rose-400/20 bg-rose-950/80 px-4 py-3 text-sm text-rose-100 shadow-xl">
          {error}
        </div>
      )}
    </MainLayout>
  );
}
