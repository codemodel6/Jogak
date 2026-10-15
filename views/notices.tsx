"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { FiChevronLeft, FiChevronRight, FiEye, FiSearch, FiStar, FiX } from "react-icons/fi";

import { noticeCategories, noticeCategoryClassName } from "@/entities/notice";
import { useBoardPostsQuery } from "@/entities/notice/hooks";
import type { Notice, NoticeCategory } from "@/entities/notice";
import { useReviewsQuery } from "@/entities/review/hooks";
import { useAuthStatusQuery } from "@/features/auth/hooks";
import Skeleton from "@/shared/ui/skeleton";
import MainLayout from "@/widgets/main-layout";

const PAGE_SIZE = 8;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

// 게시판 한 줄: 게시글이거나, '후기' 분류에 함께 보이는 만남 후기(reviews)
type BoardItem = Notice & { key: string; href: string; rating?: number };

const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function formatDate(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}`;
}

export default function NoticesPage({ initialCategory = "전체" }: { initialCategory?: NoticeCategory | "전체" }) {
  const router = useRouter();
  const { data: isAuthenticated } = useAuthStatusQuery();
  const postsQuery = useBoardPostsQuery(isAuthenticated === true);
  const reviewsQuery = useReviewsQuery("all", isAuthenticated === true);
  const [baseNow] = useState(() => Date.now());
  const notices: BoardItem[] = [
    ...(postsQuery.data?.posts ?? []).map((post) => ({ ...post, key: `post-${post.id}`, href: `/notices/${post.id}` })),
    ...(reviewsQuery.data?.reviews ?? []).map((review) => ({
      id: 0,
      key: `review-${review.reviewId}`,
      href: `/notices/review/${review.reviewId}`,
      category: "후기" as const,
      title: `${review.reviewee.name}님과의 만남 · ${review.content || review.tags.join(", ") || `별점 ${review.rating}점`}`,
      content: [review.content, ...review.tags, review.reviewee.name].join(" "),
      date: formatDate(review.createdAt),
      createdAt: review.createdAt,
      views: 0,
      isNew: baseNow - new Date(review.createdAt).getTime() < NEW_WINDOW_MS,
      author: { userId: review.reviewer.userId, name: review.reviewer.name, photo: review.reviewer.photo },
      commentCount: 0,
      rating: review.rating,
    })),
  ];
  // 서버 화면과 브라우저 첫 화면을 같게(스켈레톤) 그린다
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const loading = !mounted || isAuthenticated !== true || postsQuery.isPending || reviewsQuery.isPending;
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<NoticeCategory | "전체">(initialCategory);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  const normalizedKeyword = keyword.trim().toLowerCase();
  const filtered = notices.filter((notice) => {
    if (category !== "전체" && notice.category !== category) return false;
    if (!normalizedKeyword) return true;
    return `${notice.title} ${notice.content}`.toLowerCase().includes(normalizedKeyword);
  });
  // 필독 글은 항상 맨 위, 나머지는 최신순
  const sorted = [...filtered].sort(
    (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.createdAt.localeCompare(a.createdAt),
  );
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setKeyword(keywordInput);
    setPage(1);
  };

  const clearSearch = () => {
    setKeywordInput("");
    setKeyword("");
    setPage(1);
  };

  return (
    <MainLayout
      active="notices"
      title="게시판"
      copy="공지사항부터 자유로운 이야기, 신고와 후기까지 확인하세요."
      maxWidthClassName="max-w-[860px]"
    >
      <section className="desktop-panel mt-5 px-4 py-4 md:px-5">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="match-search-shell flex h-11 min-w-0 flex-1 items-center gap-3 px-3 text-zinc-400">
            <FiSearch className="shrink-0" />
            <input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="제목이나 내용으로 검색"
              className="w-full min-w-0 bg-transparent text-[0.9rem] text-white placeholder:text-zinc-500 focus:outline-none"
            />
            {keywordInput && (
              <button type="button" onClick={clearSearch} aria-label="검색어 지우기" className="shrink-0 text-zinc-400">
                <FiX />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-[14px] bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] px-5 text-[0.9rem] font-semibold text-white"
          >
            검색
          </button>
        </form>

        <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["전체", ...noticeCategories] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setCategory(item);
                setPage(1);
              }}
              className={cx(
                "shrink-0 rounded-full border px-4 py-1.5 text-[0.84rem] font-medium transition",
                category === item
                  ? "border-violet-400/60 bg-violet-500/25 text-white"
                  : "border-white/8 bg-white/4 text-zinc-300 hover:border-white/20",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="desktop-panel mt-4 px-2 py-2 md:px-3">
        <div className="flex items-center justify-between px-3 pb-2 pt-2 text-[0.84rem] text-zinc-400">
          <span>
            {normalizedKeyword ? `"${keyword.trim()}" 검색 결과 ` : "전체 "}
            <span className="font-semibold text-white">{loading ? "-" : sorted.length}</span>건
          </span>
          <span>
            {currentPage} / {totalPages} 페이지
          </span>
        </div>

        {loading ? (
          <ul className="divide-y divide-white/7 border-t border-white/7">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index} className="space-y-2 px-3 py-4">
                <Skeleton className="h-4 w-2/3 rounded-md" />
                <Skeleton className="h-3 w-40 rounded-md" />
              </li>
            ))}
          </ul>
        ) : pageItems.length === 0 ? (
          <div className="px-3 py-14 text-center">
            {normalizedKeyword ? (
              <>
                <p className="text-[0.95rem] font-medium text-white">검색 결과가 없어요.</p>
                <p className="mt-1.5 text-[0.86rem] text-zinc-400">다른 검색어나 분류로 다시 찾아보세요.</p>
              </>
            ) : (
              <>
                <p className="text-[0.95rem] font-medium text-white">아직 올라온 글이 없어요.</p>
                {category === "후기" && (
                  <p className="mt-1.5 break-keep text-[0.86rem] text-zinc-400">
                    매칭 후 두 사람 모두 &lsquo;만났어요&rsquo;를 누르면 후기를 남길 수 있어요.
                  </p>
                )}
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-white/7 border-t border-white/7">
            {pageItems.map((notice) => (
              <li key={notice.key}>
                <Link
                  href={notice.href}
                  className={cx(
                    "flex items-center gap-3 rounded-[14px] px-3 py-3.5 transition hover:bg-white/3",
                    notice.pinned && "bg-violet-500/6",
                  )}
                >
                  <span className="hidden w-10 shrink-0 text-center text-[0.84rem] text-zinc-500 md:block">
                    {notice.pinned ? (
                      "필독"
                    ) : notice.rating !== undefined ? (
                      <span className="inline-flex items-center gap-0.5 text-amber-300">
                        <FiStar className="fill-current text-[0.75rem]" />
                        {notice.rating}
                      </span>
                    ) : (
                      notice.id
                    )}
                  </span>
                  <span
                    className={cx(
                      "w-[3.75rem] shrink-0 rounded-md py-0.5 text-center text-[0.74rem] font-semibold",
                      noticeCategoryClassName[notice.category],
                    )}
                  >
                    {notice.category}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {notice.pinned && (
                        <span className="shrink-0 text-[0.74rem] font-semibold text-violet-300 md:hidden">필독</span>
                      )}
                      <p className={cx("truncate text-[0.95rem] text-zinc-100", notice.pinned && "font-semibold")}>
                        {notice.title}
                      </p>
                      {notice.commentCount > 0 && (
                        <span className="shrink-0 text-[0.8rem] font-semibold text-violet-300">[{notice.commentCount}]</span>
                      )}
                      {notice.isNew && (
                        <span className="shrink-0 rounded-md bg-[#8f522c] px-1.5 py-0.5 text-[0.68rem] font-semibold text-orange-100">
                          NEW
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-3 text-[0.78rem] text-zinc-500 md:hidden">
                      <span className="text-zinc-300">{notice.author.name}</span>
                      <span>{notice.date}</span>
                      {notice.rating !== undefined ? (
                        <span className="flex items-center gap-1 text-amber-300">
                          <FiStar className="fill-current" />
                          {notice.rating}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <FiEye />
                          {notice.views.toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="hidden w-20 shrink-0 truncate text-right text-[0.84rem] text-zinc-300 md:block">
                    {notice.author.name}
                  </span>
                  <span className="hidden w-24 shrink-0 text-right text-[0.84rem] text-zinc-500 md:block">
                    {notice.date}
                  </span>
                  <span className="hidden w-16 shrink-0 items-center justify-end gap-1 text-[0.84rem] text-zinc-500 md:flex">
                    {notice.rating === undefined && (
                      <>
                        <FiEye />
                        {notice.views.toLocaleString()}
                      </>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-1.5 border-t border-white/7 px-3 py-4" aria-label="페이지">
            <button
              type="button"
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage === 1}
              aria-label="이전 페이지"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-zinc-300 transition hover:bg-white/6 disabled:opacity-30"
            >
              <FiChevronLeft />
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
              <button
                key={number}
                type="button"
                onClick={() => setPage(number)}
                aria-current={number === currentPage ? "page" : undefined}
                className={cx(
                  "h-9 min-w-9 rounded-[10px] px-2 text-[0.88rem] font-medium transition",
                  number === currentPage
                    ? "bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] text-white"
                    : "text-zinc-300 hover:bg-white/6",
                )}
              >
                {number}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              aria-label="다음 페이지"
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-zinc-300 transition hover:bg-white/6 disabled:opacity-30"
            >
              <FiChevronRight />
            </button>
          </nav>
        )}
      </section>
    </MainLayout>
  );
}
