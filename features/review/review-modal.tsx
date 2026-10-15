"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiStar, FiX } from "react-icons/fi";

import { useSubmitReviewMutation } from "@/entities/review/hooks";

type ReviewModalProps = {
  chatId: string;
  matchId: string;
  partnerName: string;
  onClose: () => void;
  onDone: () => void;
};

const MAX_CONTENT_LENGTH = 80;
const MAX_TAGS = 5;
const RATING_LABELS = ["", "별로였어요", "아쉬웠어요", "보통이에요", "좋았어요", "최고예요!"];

const GOOD_TAGS = ["대화가 즐거워요", "매너가 좋아요", "시간 약속을 잘 지켜요", "프로필과 같아요", "응답이 빨라요", "또 만나고 싶어요"];
const SOSO_TAGS = ["무난했어요", "매너가 좋아요", "대화가 조금 어색했어요", "약속 시간에 조금 늦었어요"];
const BAD_TAGS = ["약속 시간에 늦었어요", "프로필과 달라요", "매너가 아쉬워요", "대화가 불편했어요"];

// 고른 칭찬 태그를 문장으로 바꿔 한줄후기 추천에 먼저 보여준다
const TAG_SENTENCES: Record<string, string> = {
  "대화가 즐거워요": "대화가 즐거워서 시간 가는 줄 몰랐어요.",
  "매너가 좋아요": "매너가 정말 좋으셨어요.",
  "시간 약속을 잘 지켜요": "약속 시간을 잘 지켜 주셔서 좋았어요.",
  "프로필과 같아요": "프로필 그대로인 분이라 믿음이 갔어요.",
  "응답이 빨라요": "답장이 빨라서 약속 잡기 편했어요.",
  "또 만나고 싶어요": "다음에 또 만나고 싶어요!",
  무난했어요: "무난하고 편한 만남이었어요.",
  "대화가 조금 어색했어요": "조금 어색했지만 괜찮은 시간이었어요.",
  "약속 시간에 조금 늦었어요": "조금 늦으셨지만 괜찮았어요.",
  "약속 시간에 늦었어요": "약속 시간을 지켜 주시면 좋겠어요.",
  "프로필과 달라요": "프로필과 달라서 아쉬웠어요.",
  "매너가 아쉬워요": "매너가 조금 아쉬웠어요.",
  "대화가 불편했어요": "대화가 조금 불편했어요.",
};

const RATING_SENTENCES: Record<number, string[]> = {
  5: ["덕분에 정말 즐거운 시간이었어요!", "배려가 느껴지는 만남이었어요.", "처음인데도 편하게 이야기 나눴어요."],
  4: ["편하게 이야기 나눌 수 있었어요.", "좋은 시간이었어요, 감사해요!", "다음에 또 봬요."],
  3: ["무난한 만남이었어요.", "나쁘지 않은 시간이었어요."],
  2: ["조금 아쉬운 만남이었어요."],
  1: ["아쉬운 만남이었어요."],
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function tagsForRating(rating: number) {
  if (rating >= 4) return GOOD_TAGS;
  if (rating === 3) return SOSO_TAGS;
  return BAD_TAGS;
}

function buildSuggestions(rating: number, tags: string[], input: string) {
  const pool = [...new Set([...tags.map((tag) => TAG_SENTENCES[tag]).filter(Boolean), ...RATING_SENTENCES[rating]])];
  const keyword = input.trim();
  if (!keyword) return pool.slice(0, 4);
  return pool.filter((sentence) => sentence !== keyword && sentence.includes(keyword)).slice(0, 4);
}

// 만남이 성사된 뒤 상대를 평가하는 모달: 별점 → 칭찬 태그 → 한줄후기(추천 문장·자동완성) → 등록
export default function ReviewModal({ chatId, matchId, partnerName, onClose, onDone }: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitMutation = useSubmitReviewMutation(chatId);

  const availableTags = tagsForRating(rating);
  const suggestions = buildSuggestions(rating, tags, content);
  // 입력한 글자로 시작하는 추천 문장이 있으면 나머지를 흐리게 보여 주고 Tab·→ 로 채운다
  const completion =
    content.length > 0 ? suggestions.find((sentence) => sentence.startsWith(content) && sentence !== content) : undefined;

  const changeRating = (value: number) => {
    setRating(value);
    const nextTags = tagsForRating(value);
    setTags((current) => current.filter((tag) => nextTags.includes(tag)));
  };

  const toggleTag = (tag: string) => {
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : current.length >= MAX_TAGS
          ? current
          : [...current, tag],
    );
  };

  const fillSentence = (sentence: string) => {
    setContent(sentence.slice(0, MAX_CONTENT_LENGTH));
    inputRef.current?.focus();
  };

  const handleSubmit = async () => {
    try {
      await submitMutation.mutateAsync({ matchId, rating, tags, content: content.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "후기 등록에 실패했어요.");
    }
  };

  return createPortal(
    // 바깥을 누르거나 ESC로는 닫히지 않는다. 닫기(X)·나중에 버튼으로만 닫는다.
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center md:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${partnerName}님 후기 남기기`}
        className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#151a2e] px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-6 shadow-2xl md:max-w-[440px] md:rounded-[26px] md:pb-6"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/8 hover:text-white"
        >
          <FiX className="text-[1.15rem]" />
        </button>

        <p className="text-center text-[0.8rem] font-medium text-violet-300">만남 완료 · 신뢰 점수 +1</p>
        <h2 className="mt-1.5 break-keep text-center text-[1.2rem] font-semibold text-white">
          {partnerName}님과의 만남은 어땠나요?
        </h2>

        {/* 별점: 한 번 누르면 끝 */}
        <div className="mt-5 flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => changeRating(value)}
              aria-label={`${value}점`}
              className="p-1 transition active:scale-90"
            >
              <FiStar
                className={cx(
                  "text-[2.1rem] transition",
                  value <= rating ? "fill-current text-amber-400" : "text-zinc-600",
                )}
              />
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-center text-[0.9rem] font-medium text-amber-200">{RATING_LABELS[rating]}</p>

        {/* 칭찬 태그: 별점에 맞는 칩만 */}
        <div className="mt-5">
          <p className="text-[0.85rem] font-medium text-zinc-300">
            {rating >= 4 ? "어떤 점이 좋았나요?" : "어떤 점이 아쉬웠나요?"}
            <span className="ml-1.5 text-[0.75rem] text-zinc-500">여러 개 골라도 돼요</span>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const selected = tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cx(
                    "flex items-center gap-1 rounded-full border px-3 py-1.5 text-[0.84rem] transition active:scale-95",
                    selected
                      ? "border-violet-400/70 bg-violet-500/30 font-medium text-white"
                      : "border-white/10 bg-white/4 text-zinc-300 hover:border-white/25",
                  )}
                >
                  {selected && <FiCheck className="text-[0.8rem]" />}
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        {/* 한줄후기: 추천 문장을 누르면 바로 채워지고, 입력 중에는 이어질 문장을 흐리게 보여준다 */}
        <div className="mt-5">
          <p className="text-[0.85rem] font-medium text-zinc-300">
            한줄후기 <span className="ml-1 text-[0.75rem] text-zinc-500">(선택)</span>
          </p>
          <div className="relative mt-2.5 rounded-[14px] border border-white/10 bg-white/4 focus-within:border-violet-400/60">
            {completion && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-3.5 py-3 text-[0.9rem]"
              >
                <span className="invisible">{content}</span>
                <span className="text-zinc-500">{completion.slice(content.length)}</span>
              </div>
            )}
            <input
              ref={inputRef}
              value={content}
              onChange={(event) => setContent(event.target.value.slice(0, MAX_CONTENT_LENGTH))}
              onKeyDown={(event) => {
                if (completion && (event.key === "Tab" || event.key === "ArrowRight") && !event.nativeEvent.isComposing) {
                  const atEnd = event.currentTarget.selectionStart === content.length;
                  if (event.key === "Tab" || atEnd) {
                    event.preventDefault();
                    setContent(completion);
                  }
                }
              }}
              placeholder="추천 문장을 누르거나 직접 써 보세요"
              className="relative w-full bg-transparent px-3.5 py-3 text-[0.9rem] text-white placeholder:text-zinc-500 focus:outline-none"
            />
          </div>
          {suggestions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {suggestions.map((sentence) => (
                <button
                  key={sentence}
                  type="button"
                  onClick={() => fillSentence(sentence)}
                  className="rounded-[10px] bg-white/6 px-2.5 py-1.5 text-left text-[0.8rem] text-zinc-200 transition hover:bg-white/12 active:scale-95"
                >
                  {sentence}
                </button>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-right text-[0.72rem] text-zinc-500">
            {content.length} / {MAX_CONTENT_LENGTH}
          </p>
        </div>

        {error && <div className="alert-error mt-2">{error}</div>}

        <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-[14px] border border-white/10 px-5 text-[0.9rem] font-medium text-zinc-300 transition hover:bg-white/6"
          >
            나중에
          </button>
          <button
            type="button"
            disabled={submitMutation.isPending}
            onClick={() => void handleSubmit()}
            className="h-12 rounded-[14px] bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] text-[0.95rem] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {submitMutation.isPending ? "등록 중..." : "후기 등록"}
          </button>
        </div>
        <p className="mt-2.5 text-center text-[0.74rem] text-zinc-500">등록한 후기는 게시판 &lsquo;후기&rsquo;에 올라가요.</p>
      </div>
    </div>,
    document.body,
  );
}
