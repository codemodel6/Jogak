"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiList, FiStar } from "react-icons/fi";

import { noticeCategoryClassName } from "@/entities/notice";
import { useReviewQuery } from "@/entities/review/hooks";
import { useAuthStatusQuery } from "@/features/auth/hooks";
import Skeleton from "@/shared/ui/skeleton";
import MainLayout from "@/widgets/main-layout";

function Avatar({ name, photo, size }: { name: string; photo?: string; size: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[linear-gradient(135deg,var(--avatar-from),var(--avatar-to))] text-[0.8rem] font-semibold text-zinc-200 ${size}`}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// 게시판 '후기' 분류에서 연 만남 후기 한 건
export default function ReviewDetailPage({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const { data: isAuthenticated } = useAuthStatusQuery();
  const reviewQuery = useReviewQuery(reviewId, isAuthenticated === true);
  const review = reviewQuery.data?.review ?? null;

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  return (
    <MainLayout
      active="notices"
      title="게시판"
      copy="공지사항부터 자유로운 이야기, 신고와 후기까지 확인하세요."
      maxWidthClassName="max-w-[860px]"
    >
      {reviewQuery.isPending ? (
        <div className="desktop-panel mt-5 space-y-4 px-5 py-6 md:px-7">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-8 w-3/4 rounded-md" />
          <div className="flex items-center gap-3 border-b border-white/7 pb-5">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>
          <Skeleton className="h-4 w-5/6 rounded-md" />
          <Skeleton className="h-7 w-48 rounded-full" />
        </div>
      ) : review ? (
        <article className="desktop-panel mt-5 px-5 py-6 md:px-7">
          <span className={`rounded-md px-2 py-0.5 text-[0.74rem] font-semibold ${noticeCategoryClassName["후기"]}`}>후기</span>
          <div className="mt-4 flex items-center gap-3">
            <Avatar name={review.reviewee.name} photo={review.reviewee.photo} size="h-12 w-12" />
            <div className="min-w-0">
              <h2 className="break-keep text-[1.25rem] font-semibold leading-snug text-white md:text-[1.45rem]">
                {review.reviewee.name}님과의 만남
              </h2>
              <span className="mt-1 flex items-center gap-0.5" aria-label={`별점 ${review.rating}점`}>
                {Array.from({ length: 5 }, (_, index) => (
                  <FiStar
                    key={index}
                    className={index < review.rating ? "fill-current text-amber-400" : "text-zinc-600"}
                  />
                ))}
              </span>
            </div>
          </div>
          <p className="mt-4 border-b border-white/7 pb-5 text-[0.8rem] text-zinc-400">
            작성 <span className="text-zinc-200">{review.reviewer.name}</span> · {formatDateTime(review.createdAt)}
          </p>
          {review.content && (
            <p className="whitespace-pre-line break-keep pt-6 text-[0.98rem] leading-8 text-zinc-200">{review.content}</p>
          )}
          {review.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {review.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-violet-500/12 px-3 py-1.5 text-[0.82rem] text-violet-200">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </article>
      ) : (
        <div className="desktop-panel mt-5 px-5 py-14 text-center">
          <p className="text-[1rem] font-medium text-white">후기를 찾을 수 없어요.</p>
          <p className="mt-1.5 text-[0.88rem] text-zinc-400">삭제되었거나 주소가 잘못되었습니다.</p>
        </div>
      )}

      <div className="mt-5 flex justify-center">
        <Link
          href="/notices?category=후기"
          className="flex items-center gap-2 rounded-[14px] border border-white/10 px-6 py-2.5 text-[0.9rem] font-medium text-white transition hover:bg-white/6"
        >
          <FiList />
          목록으로
        </Link>
      </div>
    </MainLayout>
  );
}
