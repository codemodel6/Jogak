"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiEye, FiList, FiMessageCircle, FiTrash2 } from "react-icons/fi";

import { noticeCategoryClassName } from "@/entities/notice";
import { increaseBoardView } from "@/entities/notice/api";
import {
  useAddBoardCommentMutation,
  useBoardCommentsQuery,
  useBoardPostQuery,
  useDeleteBoardCommentMutation,
} from "@/entities/notice/hooks";
import { useAuthStatusQuery, useCurrentUserIdQuery } from "@/features/auth/hooks";
import Skeleton from "@/shared/ui/skeleton";
import MainLayout from "@/widgets/main-layout";

const MAX_COMMENT_LENGTH = 500;

function Avatar({ name, photo, size }: { name: string; photo?: string; size: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[linear-gradient(135deg,#39466b,#182033)] text-[0.8rem] font-semibold text-zinc-200 ${size}`}
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

export default function NoticeDetailPage({ noticeId }: { noticeId: number }) {
  const router = useRouter();
  const { data: isAuthenticated } = useAuthStatusQuery();
  const enabled = isAuthenticated === true;
  const currentUserIdQuery = useCurrentUserIdQuery(enabled);
  const postQuery = useBoardPostQuery(noticeId, enabled);
  const commentsQuery = useBoardCommentsQuery(noticeId, enabled);
  const addComment = useAddBoardCommentMutation(noticeId);
  const deleteComment = useDeleteBoardCommentMutation(noticeId);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const notice = postQuery.data?.post ?? null;
  const comments = commentsQuery.data?.comments ?? [];
  const currentUserId = currentUserIdQuery.data ?? "";

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (enabled) {
      void increaseBoardView(noticeId);
    }
  }, [enabled, noticeId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = comment.trim();
    if (!content) return;

    try {
      await addComment.mutateAsync(content);
      setComment("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "댓글을 등록하지 못했습니다.");
    }
  };

  return (
    <MainLayout
      active="notices"
      title="게시판"
      copy="공지사항부터 자유로운 이야기, 신고와 후기까지 확인하세요."
      maxWidthClassName="max-w-[860px]"
    >
      {postQuery.isPending ? (
        <div className="desktop-panel mt-5 space-y-4 px-5 py-6 md:px-7">
          <Skeleton className="h-5 w-16 rounded-md" />
          <Skeleton className="h-8 w-3/4 rounded-md" />
          <div className="flex items-center gap-3 border-b border-white/7 pb-5">
            <Skeleton className="h-9 w-9 rounded-full" />
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-5/6 rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
      ) : notice ? (
        <article className="desktop-panel mt-5 px-5 py-6 md:px-7">
          <div className="flex items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-[0.74rem] font-semibold ${noticeCategoryClassName[notice.category]}`}>
              {notice.category}
            </span>
            {notice.pinned && <span className="text-[0.78rem] font-semibold text-violet-300">필독</span>}
          </div>
          <h2 className="mt-3 break-keep text-[1.35rem] font-semibold leading-snug text-white md:text-[1.6rem]">
            {notice.title}
          </h2>
          <div className="mt-4 flex items-center gap-3 border-b border-white/7 pb-5">
            <Avatar name={notice.author.name} photo={notice.author.photo} size="h-9 w-9" />
            <div className="min-w-0">
              <p className="text-[0.92rem] font-medium text-white">{notice.author.name}</p>
              <p className="mt-0.5 flex items-center gap-3 text-[0.8rem] text-zinc-400">
                <span>{notice.date}</span>
                <span className="flex items-center gap-1">
                  <FiEye />
                  {notice.views.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <FiMessageCircle />
                  {comments.length}
                </span>
              </p>
            </div>
          </div>
          <div className="whitespace-pre-line break-keep py-6 text-[0.98rem] leading-8 text-zinc-200">{notice.content}</div>
        </article>
      ) : (
        <div className="desktop-panel mt-5 px-5 py-14 text-center">
          <p className="text-[1rem] font-medium text-white">게시글을 찾을 수 없어요.</p>
          <p className="mt-1.5 text-[0.88rem] text-zinc-400">삭제되었거나 주소가 잘못되었습니다.</p>
        </div>
      )}

      {notice && (
        <section className="desktop-panel mt-4 px-5 py-5 md:px-7">
          <h3 className="text-[1.05rem] font-semibold text-white">
            댓글 <span className="text-violet-300">{comments.length}</span>
          </h3>

          {commentsQuery.isPending ? (
            <ul className="mt-3 space-y-4">
              {Array.from({ length: 2 }, (_, index) => (
                <li key={index} className="flex gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-24 rounded-md" />
                    <Skeleton className="h-4 w-2/3 rounded-md" />
                  </div>
                </li>
              ))}
            </ul>
          ) : comments.length === 0 ? (
            <p className="py-6 text-center text-[0.88rem] text-zinc-500">첫 댓글을 남겨 보세요.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/7">
              {comments.map((item) => (
                <li key={item.id} className="flex gap-3 py-3.5">
                  <Avatar name={item.author.name} photo={item.author.photo} size="h-8 w-8" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.88rem] font-medium text-white">{item.author.name}</span>
                      {item.author.userId === notice.author.userId && (
                        <span className="rounded bg-violet-500/18 px-1.5 py-0.5 text-[0.68rem] text-violet-200">작성자</span>
                      )}
                      <span className="text-[0.76rem] text-zinc-500">{formatDateTime(item.createdAt)}</span>
                      {item.author.userId === currentUserId && (
                        <button
                          type="button"
                          onClick={() => void deleteComment.mutateAsync(item.id)}
                          aria-label="댓글 삭제"
                          className="ml-auto text-zinc-500 transition hover:text-rose-300"
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-line break-words text-[0.92rem] leading-6 text-zinc-200">
                      {item.content}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleSubmit} className="mt-3 flex items-end gap-2">
            <div className="chat-input-shell min-w-0 flex-1 px-4 py-2.5">
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value.slice(0, MAX_COMMENT_LENGTH))}
                placeholder="댓글을 입력하세요"
                rows={2}
                className="w-full resize-none bg-transparent text-[0.92rem] text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <p className="text-right text-[0.72rem] text-zinc-500">
                {comment.length}/{MAX_COMMENT_LENGTH}
              </p>
            </div>
            <button type="submit" disabled={addComment.isPending || !comment.trim()} className="btn-primary shrink-0 px-5">
              등록
            </button>
          </form>
          {error && <div className="alert-error mt-3">{error}</div>}
        </section>
      )}

      <div className="mt-4 flex justify-center">
        <Link
          href="/notices"
          className="flex items-center gap-2 rounded-[14px] border border-white/10 px-6 py-2.5 text-[0.9rem] font-medium text-white transition hover:bg-white/6"
        >
          <FiList />
          목록으로
        </Link>
      </div>
    </MainLayout>
  );
}
