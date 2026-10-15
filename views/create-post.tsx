"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCamera, FiChevronLeft, FiX } from "react-icons/fi";

import { MAX_POST_TAGS } from "@/entities/post/api";
import { useCreatePostMutation } from "@/entities/post/hooks";
import { useAuthStatusQuery } from "@/features/auth/hooks";
import MainLayout from "@/widgets/main-layout";

const MAX_COVER_SIZE = 10 * 1024 * 1024;
const MAX_TAG_LENGTH = 10;
const MAX_TITLE_LENGTH = 50;

export default function CreatePostPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: isAuthenticated } = useAuthStatusQuery();
  const createPostMutation = useCreatePostMutation();

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const handleCover = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 등록할 수 있습니다.");
      return;
    }
    if (file.size > MAX_COVER_SIZE) {
      setError("이미지는 10MB 이하만 등록할 수 있습니다.");
      return;
    }
    setError(null);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const addTag = (raw: string = tagInput) => {
    const value = raw.trim().replace(/^#+/, "").replace(/[\s,]+/g, "");
    if (!value) return;
    if (tags.length >= MAX_POST_TAGS) {
      setError(`태그는 ${MAX_POST_TAGS}개까지 넣을 수 있어요.`);
      return;
    }
    if (!tags.includes(value)) {
      setTags([...tags, value.slice(0, MAX_TAG_LENGTH)]);
    }
    setTagInput("");
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }
    if (tags.length === 0) {
      setError("검색에 쓰이도록 태그를 1개 이상 넣어 주세요.");
      return;
    }

    try {
      await createPostMutation.mutateAsync({ title: title.trim(), content: "", tags, coverFile });
      router.push("/matching");
    } catch (err) {
      setError(err instanceof Error ? err.message : "게시글 작성에 실패했습니다.");
    }
  };

  return (
    <MainLayout active="matching" title="매칭 글쓰기" copy="제목 한두 줄과 태그로 만남을 올려 보세요." maxWidthClassName="max-w-[760px]">
      <button
        type="button"
        onClick={() => router.push("/matching")}
        className="mt-4 inline-flex items-center gap-1.5 text-[0.88rem] text-zinc-300 transition hover:text-white"
      >
        <FiChevronLeft />
        매칭으로
      </button>

      <form onSubmit={handleSubmit} className="desktop-panel mt-3 space-y-5 px-5 py-5 md:px-6">
        <div className="flex items-center gap-4">
          <label className="relative block h-24 w-24 shrink-0 cursor-pointer overflow-hidden rounded-[20px] border border-white/10">
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverPreview} alt="대표 이미지" className="h-full w-full object-cover" />
            ) : (
              <Image src="/icons/icon-192.png" alt="기본 이미지" fill className="object-cover opacity-80" />
            )}
            <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
              <FiCamera className="text-[0.85rem]" />
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                handleCover(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <div className="min-w-0">
            <p className="text-[0.95rem] font-medium text-white">대표 이미지</p>
            <p className="mt-1 break-keep text-[0.8rem] text-zinc-400">
              매칭 목록에 보일 이미지예요. 등록하지 않으면 기본 이미지가 보여요.
            </p>
            {coverFile && (
              <button
                type="button"
                onClick={() => {
                  setCoverFile(null);
                  setCoverPreview(null);
                }}
                className="mt-2 text-[0.8rem] text-rose-300 hover:text-rose-200"
              >
                이미지 빼기
              </button>
            )}
          </div>
        </div>

        <label className="label-text">
          제목
          <textarea
            className="input-field resize-none leading-6"
            rows={2}
            value={title}
            onChange={(event) => setTitle(event.target.value.replace(/\n/g, " ").slice(0, MAX_TITLE_LENGTH))}
            placeholder="예: 오늘 건대역 저녁 같이 드실 분~"
          />
          <span className="mt-1 block text-right text-[0.75rem] text-zinc-500">
            {title.length} / {MAX_TITLE_LENGTH}
          </span>
        </label>

        <div>
          <p className="label-text">
            태그 <span className="text-[0.78rem] text-zinc-500">({tags.length}/{MAX_POST_TAGS})</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-white/3 px-3 py-2.5">
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 rounded-full bg-violet-500/18 px-2.5 py-1 text-[0.82rem] text-violet-100">
                #{tag}
                <button type="button" onClick={() => setTags(tags.filter((item) => item !== tag))} aria-label={`${tag} 태그 삭제`}>
                  <FiX className="text-[0.75rem]" />
                </button>
              </span>
            ))}
            {tags.length < MAX_POST_TAGS && (
              <input
                value={tagInput}
                // 스페이스·쉼표는 입력값으로 받아 처리한다. 한글은 조합 중에 키를 가로채면
                // 마지막 글자(예: "건대"의 "대")가 조합이 끝난 뒤 입력칸에 다시 남기 때문이다.
                onChange={(event) => {
                  const value = event.target.value;
                  if (/[\s,]$/.test(value)) {
                    addTag(value);
                    return;
                  }
                  setTagInput(value);
                }}
                // Enter 는 폼 전송만 막고, 태그 추가는 키를 뗄 때 한다(한글 조합이 끝난 값으로 추가)
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                  }
                }}
                onKeyUp={(event) => {
                  if (event.key === "Enter") {
                    addTag(event.currentTarget.value);
                  }
                }}
                onBlur={() => addTag()}
                maxLength={MAX_TAG_LENGTH + 1}
                className="min-w-[8rem] flex-1 bg-transparent text-[0.88rem] text-white placeholder:text-zinc-500 focus:outline-none"
              />
            )}
          </div>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="flex gap-3">
          <button type="button" onClick={() => router.push("/matching")} className="btn-secondary flex-1">
            취소
          </button>
          <button type="submit" disabled={createPostMutation.isPending} className="btn-primary flex-1">
            {createPostMutation.isPending ? "등록 중..." : "등록"}
          </button>
        </div>
      </form>
    </MainLayout>
  );
}
