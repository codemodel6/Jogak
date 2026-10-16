"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LuArrowDownUp } from "react-icons/lu";
import { FiCamera, FiCameraOff, FiEdit3, FiHeart, FiMessageCircle, FiSearch, FiStar, FiTrendingUp, FiUsers, FiX } from "react-icons/fi";

import { useMatchStatsQuery, useStartPostChatMutation, useChatsQuery } from "@/entities/chat/hooks";
import { isBoosted, type Post } from "@/entities/post";
import { useBoostPostMutation, usePostsQuery } from "@/entities/post/hooks";
import { useProfileQuery } from "@/entities/profile/hooks";
import { useWalletQuery } from "@/entities/wallet/hooks";
import { useAuthStatusQuery } from "@/features/auth/hooks";
import BoostSheet from "@/features/match/boost-sheet";
import WalletBar from "@/features/wallet/wallet-bar";
import { useOnlineUsers } from "@/shared/lib/presence/online-users";
import Skeleton from "@/shared/ui/skeleton";
import MainLayout from "@/widgets/main-layout";

type MatchExperienceProps = {
  mobileView?: "list";
};

type MatchCardData = Post;

const matchTabs = [
  { key: "all", label: "전체" },
  { key: "saved", label: "찜한 글" },
  { key: "mine", label: "내가 쓴 글" },
  { key: "chatting", label: "대화 중" },
] as const;

// 태그 검색 점수: 태그와 정확히 같으면 3, 검색어가 태그를 포함하면 2(건대역 → #건대), 태그가 검색어를 포함하면 1(건 → #건대)
function tagScore(tags: string[], keyword: string) {
  if (!keyword) return 0;
  return tags.reduce((best, raw) => {
    const tag = raw.toLowerCase();
    const score = tag === keyword ? 3 : keyword.includes(tag) ? 2 : tag.includes(keyword) ? 1 : 0;
    return Math.max(best, score);
  }, 0);
}

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatRelativeLabel(createdAt: string, now: number) {
  const diff = now - new Date(createdAt).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));

  if (minutes < 60) {
    return `${minutes}분 전`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}시간 전`;
  }

  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export default function MatchingExperience({ mobileView = "list" }: MatchExperienceProps) {
  const router = useRouter();
  void mobileView;
  const [activeTab, setActiveTab] = useState<(typeof matchTabs)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"latest" | "accuracy">("latest");
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [matchingEnabled, setMatchingEnabled] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailPostId, setDetailPostId] = useState<string | null>(null);
  const [baseNow] = useState(() => Date.now());
  const { data: isAuthenticated } = useAuthStatusQuery();
  const queryEnabled = isAuthenticated === true;
  const postsQuery = usePostsQuery(queryEnabled);
  const profileQuery = useProfileQuery(queryEnabled);
  const chatsQuery = useChatsQuery(queryEnabled);
  const matchStatsQuery = useMatchStatsQuery(queryEnabled);
  const requestChatMutation = useStartPostChatMutation();
  const boostMutation = useBoostPostMutation();
  const walletQuery = useWalletQuery(queryEnabled);
  const wallet = walletQuery.data;
  // 사진 필터: 실물 사진을 등록한 사람(공개) / 안 한 사람(비공개)
  const [photoFilter, setPhotoFilter] = useState<"all" | "public" | "private">("all");
  const [boostCard, setBoostCard] = useState<MatchCardData | null>(null);
  const [boostError, setBoostError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  const posts: Post[] = postsQuery.data?.posts ?? [];
  const chats = chatsQuery.data?.chats ?? [];
  const profile = profileQuery.data?.profile;
  const currentUserId = profile?.userId ?? "";
  const onlineCount = useOnlineUsers(profile?.userId);
  const matchStats = matchStatsQuery.data;
  const formatCount = (value: number | undefined, unit: string) =>
    value === undefined ? null : `${value.toLocaleString("ko-KR")}${unit}`;
  const stats = [
    { icon: FiUsers, label: "현재 접속 중", value: formatCount(onlineCount || undefined, "명"), color: "text-violet-400" },
    { icon: FiHeart, label: "오늘 매칭 성공", value: formatCount(matchStats?.todayMatched, "건"), color: "text-violet-400" },
    { icon: FiStar, label: "누적 매칭 성공", value: formatCount(matchStats?.totalMatched, "건"), color: "text-amber-400" },
  ];
  const loading =
    isAuthenticated === undefined || postsQuery.isPending || profileQuery.isPending || chatsQuery.isPending;
  const queryError = postsQuery.error ?? profileQuery.error ?? chatsQuery.error;
  const error =
    actionError ??
    (queryError instanceof Error ? queryError.message : queryError ? "매칭 정보를 불러오지 못했습니다." : null);

  const myPosts = posts.filter((post) => post.userId === currentUserId);
  // 내 글도 목록에 함께 보여준다(내 글에는 "내 글" 표시, 대화하기 버튼 없음)
  const realPosts = posts.filter((post) => post.userId);
  // 서버 렌더와 첫 화면(hydration)은 항상 스켈레톤으로 같게 그리고, 브라우저에서 글을 불러온 뒤 목록을 그린다
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const postsLoading = !mounted || isAuthenticated === undefined || postsQuery.isPending;
  const sourcePosts: MatchCardData[] = realPosts;
  const chattingPostIds = new Set(chats.map((chat) => chat.postId).filter(Boolean));
  const chattingNames = chats.filter((chat) => !chat.postId).map((chat) => chat.otherUser.name);

  const keyword = search.trim().replace(/^#+/, "").replace(/\s+/g, "").toLowerCase();
  const displayedCards = sourcePosts
    .map((post) => ({
      ...post,
      isMine: Boolean(currentUserId) && post.userId === currentUserId,
      relativeTime: formatRelativeLabel(post.createdAt, baseNow),
      isNew: baseNow - new Date(post.createdAt).getTime() < 24 * 60 * 60 * 1000,
      boosted: isBoosted(post, baseNow),
      score: tagScore(post.tags, keyword),
    }))
    .filter((card) => {
      if (keyword && card.score === 0) return false;
      if (selectedTag && !card.tags.includes(selectedTag)) return false;
      if (photoFilter === "public" && !card.authorHasFace) return false;
      if (photoFilter === "private" && card.authorHasFace) return false;
      if (activeTab === "saved") return bookmarkedIds.includes(card.postId);
      if (activeTab === "mine") return card.isMine;
      if (activeTab === "chatting") return chattingPostIds.has(card.postId) || chattingNames.includes(card.userName);
      return true;
    })
    // 상단 노출 중인 글이 먼저. 그다음 기본은 최신순, "정확" 정렬이면 태그 일치 점수가 높은 글부터(같으면 최신순)
    .sort((a, b) => {
      const byDate = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      const byBoost = Number(b.boosted) - Number(a.boosted);
      return byBoost || (sortOrder === "accuracy" ? b.score - a.score || byDate : byDate);
    });

  const detailCard = displayedCards.find((card) => card.postId === detailPostId) ?? null;

  const handleBookmark = (postId: string) => {
    setBookmarkedIds((current) =>
      current.includes(postId)
        ? current.filter((id) => id !== postId)
        : [...current, postId],
    );
  };

  // 대화하기: 이 글로 이미 대화 중이면 그 방으로, 아니면 새 방을 열어 바로 이동한다(무료. 매칭권은 매칭 요청 때)
  const handleRequestChat = async (card: MatchCardData) => {
    if (!card.userId) {
      return;
    }

    const existing = chats.find((chat) => chat.postId === card.postId);
    if (existing) {
      router.push(`/chat/${existing.chatId}`);
      return;
    }

    try {
      const response = await requestChatMutation.mutateAsync(card.postId);
      setActionError(null);
      router.push(`/chat/${response.chatId}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "대화를 시작하지 못했어요.");
    }
  };

  const confirmBoost = async () => {
    if (!boostCard) return;

    try {
      await boostMutation.mutateAsync(boostCard.postId);
      setBoostCard(null);
    } catch (err) {
      setBoostError(err instanceof Error ? err.message : "상단 노출에 실패했어요.");
    }
  };

  const handleMatchingActivation = () => {
    if (!matchingEnabled || myPosts.length === 0) {
      router.push("/create-post");
      return;
    }

    setMatchingEnabled((current) => !current);
  };

  const activationToggle = (
    <button
      type="button"
      onClick={handleMatchingActivation}
      aria-label="매칭 활성화"
      className="flex items-center gap-3 rounded-[16px] border border-white/7 bg-surface px-3 py-2 sm:px-4 sm:py-2.5"
    >
      <span className="hidden text-[0.95rem] font-medium text-white sm:inline">매칭 활성화</span>
      <span
        className={cx(
          "relative flex h-7 w-11 items-center rounded-full px-1 transition",
          matchingEnabled ? "bg-[#6f56ff]" : "bg-white/12",
        )}
      >
        <span
          className={cx(
            "flex h-5 w-5 items-center justify-center rounded-full bg-[#fff] text-[#6f56ff] transition",
            matchingEnabled ? "translate-x-4" : "translate-x-0",
          )}
        >
          <FiHeart className="fill-current text-[0.85rem]" />
        </span>
      </span>
    </button>
  );

  return (
    <MainLayout
      active="matching"
      title="매칭"
      copy="당신과 잘 맞는 사람들의 만남 글을 확인하고, 대화를 요청해보세요."
      headerActions={activationToggle}
    >
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <main className="flex min-w-0 flex-col gap-4">
          <WalletBar wallet={wallet} />
          {/* 필터: 탭 · 검색 · 태그 */}
          <section className="desktop-panel space-y-3.5 px-4 py-4 md:px-5">
            <div className="flex items-center gap-2">
              <div className="match-search-shell flex h-11 min-w-0 flex-1 items-center gap-3 px-3.5 text-zinc-400">
                <FiSearch className="shrink-0" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full min-w-0 bg-transparent text-[0.9rem] text-white placeholder:text-zinc-500 focus:outline-none"
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} aria-label="검색어 지우기">
                    <FiX />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
            <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {matchTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={cx(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-[0.84rem] font-medium transition",
                    activeTab === tab.key ? "bg-foreground text-background" : "bg-white/5 text-zinc-300 hover:bg-white/10",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {/* 정렬: 누를 때마다 최신순 ↔ 정확도순 */}
            <button
              type="button"
              onClick={() => setSortOrder(sortOrder === "latest" ? "accuracy" : "latest")}
              className="flex shrink-0 items-center gap-1 text-[0.82rem] font-medium text-zinc-400 transition hover:text-white"
            >
              <LuArrowDownUp className="text-[0.9rem]" />
              {sortOrder === "latest" ? "최신순" : "정확도순"}
            </button>
            </div>

            {/* 사진 공개 여부 필터 */}
            <div className="flex items-center gap-1.5">
              {([
                { key: "all", label: "사진 전체", icon: null },
                { key: "public", label: "사진 공개", icon: FiCamera },
                { key: "private", label: "사진 비공개", icon: FiCameraOff },
              ] as const).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPhotoFilter(item.key)}
                  className={cx(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.8rem] font-medium transition",
                    photoFilter === item.key
                      ? "border-violet-400/60 bg-violet-500/20 text-white"
                      : "border-white/8 text-zinc-400 hover:border-white/20 hover:text-zinc-200",
                  )}
                >
                  {item.icon && <item.icon className="text-[0.85rem]" />}
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            {postsLoading ? (
              // 불러오는 중: 실제 카드와 같은 모양의 스켈레톤
              Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="match-panel flex items-stretch gap-3.5 p-3 md:gap-4 md:p-3.5">
                  <Skeleton className="h-[76px] w-[76px] shrink-0 rounded-[14px] md:h-[84px] md:w-[84px]" />
                  <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-20 rounded-md" />
                      <Skeleton className="h-4 w-4/5 rounded-md" />
                    </div>
                    <div className="flex gap-1.5">
                      <Skeleton className="h-6 w-14 rounded-lg" />
                      <Skeleton className="h-6 w-16 rounded-lg" />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end justify-between">
                    <Skeleton className="h-8 w-8 rounded-[10px]" />
                    <Skeleton className="h-9 w-9 rounded-[11px] sm:w-[92px]" />
                  </div>
                </div>
              ))
            ) : displayedCards.length === 0 ? (
              <div className="match-panel px-6 py-10 text-center">
                <p className="text-[1rem] font-semibold text-white">조건에 맞는 글이 아직 없어요.</p>
                <p className="mt-2 text-[0.88rem] text-zinc-400">필터를 초기화하거나 직접 글을 올려 보세요.</p>
              </div>
            ) : (
              displayedCards.map((card) => (
                <article
                  key={card.postId}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailPostId(card.postId)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      setDetailPostId(card.postId);
                    }
                  }}
                  className={cx(
                    "match-panel group relative flex cursor-pointer items-stretch gap-3.5 overflow-hidden p-3 transition hover:border-violet-400/25 focus-visible:outline-2 focus-visible:outline-violet-400 md:gap-4 md:p-3.5",
                    card.boosted && "border-violet-400/45 bg-accent-tint",
                  )}
                >
                  {/* 왼쪽 강조선: 새 글이면 보라색 */}
                  <span
                    aria-hidden
                    className={cx(
                      "absolute inset-y-3 left-0 w-[3px] rounded-r-full",
                      card.isNew ? "bg-[linear-gradient(180deg,#8b6dff,#5c3df0)]" : "bg-white/6",
                    )}
                  />

                  <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[14px] border border-white/8 md:h-[84px] md:w-[84px]">
                    {card.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={card.coverUrl} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    ) : (
                      <Image src="/icons/icon-192.png" alt="" fill sizes="84px" className="object-cover transition duration-300 group-hover:scale-105" />
                    )}
                    {card.boosted ? (
                      <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded-md bg-[linear-gradient(135deg,#f59e0b,#ef4444)] px-1.5 py-[1px] text-[0.62rem] font-bold tracking-wide text-on-accent shadow">
                        <FiTrendingUp /> UP
                      </span>
                    ) : (
                      card.isNew && (
                        <span className="absolute left-1 top-1 rounded-md bg-[#6f56ff] px-1.5 py-[1px] text-[0.62rem] font-bold tracking-wide text-on-accent shadow">
                          NEW
                        </span>
                      )
                    )}
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-1.5 py-0.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[0.74rem] text-zinc-500">
                        {card.isMine && (
                          <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-[1px] font-semibold text-zinc-200">내 글</span>
                        )}
                        {card.userName && (
                          <>
                            <span className="truncate font-medium text-zinc-300">{card.userName}</span>
                            <span aria-hidden>·</span>
                          </>
                        )}
                        <span className="shrink-0">{card.relativeTime}</span>
                      </div>
                      <h3 className="mt-0.5 line-clamp-2 break-keep text-[0.98rem] font-semibold leading-snug text-white md:text-[1.06rem]">
                        {card.title}
                      </h3>
                    </div>
                    {card.tags.length > 0 && (
                      <div className="flex min-w-0 gap-1.5 overflow-hidden">
                        {card.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedTag(selectedTag === tag ? null : tag);
                            }}
                            className={cx(
                              "shrink-0 rounded-lg px-2.5 py-1 text-[0.84rem] font-medium transition md:text-[0.88rem]",
                              selectedTag === tag
                                ? "bg-violet-500/40 text-white"
                                : "bg-violet-500/18 text-violet-100 hover:bg-violet-500/28",
                            )}
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col items-end justify-between">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleBookmark(card.postId);
                      }}
                      aria-label="찜하기"
                      className="flex h-8 w-8 items-center justify-center rounded-[10px] text-zinc-500 transition hover:bg-white/6 hover:text-zinc-200"
                    >
                      <FiHeart className={cx("text-[1rem]", bookmarkedIds.includes(card.postId) && "fill-current text-violet-300")} />
                    </button>
                    {card.isMine && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setBoostError(null);
                          setBoostCard(card);
                        }}
                        aria-label="상단 노출"
                        className={cx(
                          "flex h-9 items-center gap-1.5 rounded-[11px] px-2.5 text-[0.8rem] font-semibold transition sm:px-3",
                          card.boosted
                            ? "border border-violet-400/40 text-violet-300 hover:bg-accent-tint"
                            : "border border-white/12 text-zinc-200 hover:bg-white/6",
                        )}
                      >
                        <FiTrendingUp className="text-[0.95rem]" />
                        <span className="hidden sm:inline">{card.boosted ? "노출 중" : "상단 노출"}</span>
                      </button>
                    )}
                    {!card.isMine && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleRequestChat(card);
                        }}
                        disabled={requestChatMutation.isPending || loading}
                        aria-label="대화하기"
                        className="flex h-9 items-center gap-1.5 rounded-[11px] bg-[linear-gradient(135deg,rgba(111,86,255,0.92),rgba(82,58,207,0.92))] px-2.5 text-[0.82rem] font-semibold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 sm:px-3.5"
                      >
                        <FiMessageCircle className="text-[0.95rem]" />
                        <span className="hidden sm:inline">대화하기</span>
                      </button>
                    )}
                  </div>
                </article>
              ))
            )}
          </section>

          {/* 글쓰기: 모바일은 화면 오른쪽 아래(탭바 위) 고정, PC는 리스트 오른쪽 끝에 붙어서 스크롤을 따라온다 */}
          <div className="xl:sticky xl:bottom-8 xl:z-[95] xl:flex xl:justify-end">
            <Link
              href="/create-post"
              aria-label="글쓰기"
              className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] right-4 z-[95] flex h-14 w-14 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#7b5cff,#5c3df0)] text-on-accent shadow-[0_12px_28px_rgba(92,61,240,0.45)] ring-1 ring-white/15 transition hover:brightness-110 active:scale-95 xl:static xl:h-12 xl:w-auto xl:px-5"
            >
              <FiEdit3 className="text-[1.3rem] xl:text-[1.05rem]" />
              <span className="hidden text-[0.92rem] font-semibold xl:inline">글쓰기</span>
            </Link>
          </div>
        </main>

        {/* 보조 단: PC에서는 오른쪽에 고정, 모바일에서는 목록 아래 */}
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-5">
          <section className="grid grid-cols-3 gap-2.5">
            {stats.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="match-panel px-2 py-3.5 text-center">
                  <Icon className={cx("mx-auto text-[1.3rem]", item.color)} />
                  <p className="mt-2.5 text-[0.74rem] text-zinc-300">{item.label}</p>
                  {item.value === null ? (
                    <Skeleton className="mx-auto mt-2 h-4 w-12 rounded-md" />
                  ) : (
                    <p className="mt-1.5 text-[0.92rem] font-semibold text-white">{item.value}</p>
                  )}
                </div>
              );
            })}
          </section>
        </aside>
      </div>

      {detailCard && (
        <PostDetailModal
          card={detailCard}
          bookmarked={bookmarkedIds.includes(detailCard.postId)}
          chatDisabled={requestChatMutation.isPending || loading}
          onBookmark={() => handleBookmark(detailCard.postId)}
          onChat={() => void handleRequestChat(detailCard)}
          onClose={() => setDetailPostId(null)}
        />
      )}

      {boostCard && (
        <BoostSheet
          postTitle={boostCard.title}
          points={wallet?.points}
          boostedUntil={posts.find((post) => post.postId === boostCard.postId)?.boostedUntil}
          pending={boostMutation.isPending}
          error={boostError}
          onConfirm={() => void confirmBoost()}
          onClose={() => setBoostCard(null)}
        />
      )}

      {error && (
        <div className="fixed right-4 top-4 z-[120] rounded-2xl border border-rose-400/20 bg-rose-950/80 px-4 py-3 text-sm text-rose-100 shadow-xl">
          {error}
        </div>
      )}
    </MainLayout>
  );
}

type PostDetailModalProps = {
  card: MatchCardData & { relativeTime: string; isNew: boolean; isMine: boolean };
  bookmarked: boolean;
  chatDisabled: boolean;
  onBookmark: () => void;
  onChat: () => void;
  onClose: () => void;
};

// 게시글 상세: 리스트에서 글을 누르면 뜨는 모달. 여기서도 바로 대화를 시작할 수 있다.
function PostDetailModal({ card, bookmarked, chatDisabled, onBookmark, onChat, onClose }: PostDetailModalProps) {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={card.title}
        onClick={(event) => event.stopPropagation()}
        className="match-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-b-none sm:max-w-[520px] sm:rounded-b-[1.35rem]"
      >
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-white/4">
          {card.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <Image src="/icons/icon-192.png" alt="" fill sizes="520px" className="object-cover opacity-90" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,transparent,var(--surface))]" />
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
          >
            <FiX className="text-[1.1rem]" />
          </button>
          {card.isNew && (
            <span className="absolute left-3 top-3 rounded-md bg-[#6f56ff] px-2 py-0.5 text-[0.7rem] font-bold tracking-wide text-on-accent shadow">
              NEW
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
          <div className="flex items-center gap-1.5 text-[0.8rem] text-zinc-500">
            {card.userName && (
              <>
                <span className="font-medium text-zinc-300">{card.userName}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{card.relativeTime}</span>
          </div>
          <h2 className="mt-1.5 break-keep text-[1.25rem] font-bold leading-snug text-white">{card.title}</h2>

          {card.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {card.tags.map((tag) => (
                <span key={tag} className="rounded-lg bg-violet-500/18 px-2.5 py-1 text-[0.84rem] font-medium text-violet-100">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 gap-2 border-t border-white/6 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onBookmark}
            aria-label="찜하기"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-white/8 text-zinc-300 transition hover:bg-white/6"
          >
            <FiHeart className={cx("text-[1.15rem]", bookmarked && "fill-current text-violet-300")} />
          </button>
          {!card.isMine && (
            <button
              type="button"
              onClick={onChat}
              disabled={chatDisabled}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] text-[0.95rem] font-semibold text-on-accent transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <FiMessageCircle className="text-[1.05rem]" />
              대화하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
