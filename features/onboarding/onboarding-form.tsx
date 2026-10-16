"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCamera, FiLock, FiUser, FiX } from "react-icons/fi";

import { useAuthStatusQuery } from "@/features/auth/hooks";
import {
  useCompleteOnboardingMutation,
  useProfileQuery,
} from "@/entities/profile/hooks";

const GENDER_OPTIONS = ["남성", "여성"] as const;

const PURPOSE_OPTIONS = ["재미", "헌팅", "친목", "진지한 만남", "술 한잔", "대화 상대"] as const;

const MBTI_OPTIONS = [
  "ISTJ", "ISFJ", "INFJ", "INTJ",
  "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP",
  "ESTJ", "ESFJ", "ENFJ", "ENTJ",
] as const;

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

type PhotoSlot = { file: File; previewUrl: string } | null;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function OptionChips<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: readonly T[];
  value: string;
  onChange: (value: T) => void;
  columns: string;
}) {
  return (
    <div className={cx("mt-2 grid gap-2", columns)}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cx(
            "rounded-2xl border px-3 py-2.5 text-sm font-medium transition",
            value === option
              ? "border-violet-400/70 bg-violet-500/25 text-white"
              : "border-white/8 bg-white/4 text-zinc-300 hover:border-white/20",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export default function OnboardingForm() {
  const router = useRouter();
  const { data: isAuthenticated } = useAuthStatusQuery();
  const profileQuery = useProfileQuery(isAuthenticated === true);
  const completeMutation = useCompleteOnboardingMutation();

  const [nickname, setNickname] = useState("");
  const [gender, setGender] = useState("");
  const [height, setHeight] = useState("");
  const [mbti, setMbti] = useState("");
  const [purpose, setPurpose] = useState("");
  // 사진 2가지: 프로필 아이콘(채팅·내 정보에 보임, 선택) / 실물 사진(매칭 확정 때만 상대에게, '등록 안 할래요' 가능)
  const [avatar, setAvatar] = useState<PhotoSlot>(null);
  const [face, setFace] = useState<PhotoSlot>(null);
  const [faceHidden, setFaceHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    } else if (profileQuery.data?.profile.onboarded) {
      router.replace("/home");
    }
  }, [isAuthenticated, profileQuery.data, router]);

  useEffect(() => {
    return () => {
      [avatar, face].forEach((slot) => slot && URL.revokeObjectURL(slot.previewUrl));
    };
    // 언마운트 시 미리보기 URL만 정리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickPhoto = (file: File | undefined, setSlot: (updater: (prev: PhotoSlot) => PhotoSlot) => void) => {
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 등록할 수 있습니다.");
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setError("사진은 10MB 이하만 등록할 수 있습니다.");
      return;
    }
    setError(null);
    setSlot((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file) };
    });
  };

  const clearPhoto = (setSlot: (updater: (prev: PhotoSlot) => PhotoSlot) => void) => {
    setSlot((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedNickname = nickname.trim();

    if (trimmedNickname.length < 2 || trimmedNickname.length > 12) {
      setError("닉네임은 2~12자로 입력해 주세요.");
      return;
    }
    if (!gender || !mbti || !purpose) {
      setError("성별, MBTI, 목적을 모두 선택해 주세요.");
      return;
    }
    if (!faceHidden && !face) {
      setError("실물 사진을 등록하거나 '실물 등록 안 할래요'를 켜 주세요.");
      return;
    }

    try {
      await completeMutation.mutateAsync({
        nickname: trimmedNickname,
        gender,
        height,
        mbti,
        purpose,
        avatarFile: avatar?.file ?? null,
        faceFile: faceHidden ? null : (face?.file ?? null),
      });
      router.replace("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "프로필 저장 실패");
    }
  };

  return (
    <div className="app-frame flex min-h-screen items-center justify-center p-4">
      <div className="surface-panel w-full max-w-xl">
        <p className="section-kicker">조각</p>
        <h1 className="section-title">프로필 설정</h1>
        <p className="section-copy">처음 오셨네요. 나를 소개할 정보를 입력해 주세요.</p>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <label className="label-text">
            닉네임
            <input
              className="input-field"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="2~12자"
              maxLength={12}
              required
            />
          </label>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="label-text">
              성별
              <OptionChips
                options={GENDER_OPTIONS}
                value={gender}
                onChange={setGender}
                columns="grid-cols-2"
              />
            </div>
            <label className="label-text">
              키 (cm)
              <input
                className="input-field"
                type="number"
                inputMode="numeric"
                min={100}
                max={250}
                value={height}
                onChange={(event) => setHeight(event.target.value)}
                placeholder="170"
              />
            </label>
          </div>

          <div className="label-text">
            MBTI
            <OptionChips
              options={MBTI_OPTIONS}
              value={mbti}
              onChange={setMbti}
              columns="grid-cols-4"
            />
          </div>

          <div className="label-text">
            목적
            <OptionChips
              options={PURPOSE_OPTIONS}
              value={purpose}
              onChange={setPurpose}
              columns="grid-cols-3"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* 프로필 아이콘: 선택. 없으면 기본 아이콘 */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="label-text">프로필 아이콘</span>
                <span className="text-[0.75rem] text-zinc-500">선택</span>
              </div>
              <p className="mt-1 break-keep text-[0.78rem] leading-5 text-zinc-400">
                채팅과 내 정보에 보이는 사진이에요. 등록하지 않아도 기본 아이콘으로 시작할 수 있어요.
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-dashed border-white/15 bg-white/4">
                  {avatar ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatar.previewUrl} alt="프로필 아이콘" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => clearPhoto(setAvatar)}
                        className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                        aria-label="프로필 아이콘 삭제"
                      >
                        <FiX className="text-[0.8rem]" />
                      </button>
                    </>
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[1.8rem] text-zinc-500">
                      <FiUser />
                    </span>
                  )}
                </div>
                <label className="btn-secondary cursor-pointer px-3.5 py-2 text-[0.82rem]">
                  {avatar ? "바꾸기" : "아이콘 고르기"}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => {
                      pickPhoto(event.target.files?.[0], setAvatar);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            {/* 실물 사진: 매칭 확정 때만 상대에게. '실물 등록 안 할래요' 가능 */}
            <div className="rounded-2xl border border-white/8 bg-white/3 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="label-text">실물 사진</span>
                <label className="flex cursor-pointer items-center gap-2 text-[0.78rem] text-zinc-300">
                  실물 등록 안 할래요
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={faceHidden}
                    onChange={(event) => setFaceHidden(event.target.checked)}
                  />
                  <span className="relative h-6 w-11 rounded-full bg-white/12 transition after:absolute after:top-1 after:left-1 after:h-4 after:w-4 after:rounded-full after:bg-[#fff] after:shadow-sm after:transition peer-checked:bg-violet-500 peer-checked:after:translate-x-5" />
                </label>
              </div>
              <p className="mt-1 flex items-start gap-1 break-keep text-[0.78rem] leading-5 text-zinc-400">
                <FiLock className="mt-[3px] shrink-0" />
                {faceHidden
                  ? "실물 사진 없이 시작해요. 매칭 확인 때 상대에게는 프로필 아이콘이 보여요."
                  : "평소에는 아무에게도 보이지 않고, 매칭을 확정할 때만 상대에게 보여요."}
              </p>
              {!faceHidden && (
                <div className="relative mt-3 aspect-[3/4] w-28 overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/4">
                  {face ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={face.previewUrl} alt="실물 사진" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => clearPhoto(setFace)}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                        aria-label="실물 사진 삭제"
                      >
                        <FiX />
                      </button>
                    </>
                  ) : (
                    <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-zinc-500 transition hover:text-zinc-300">
                      <FiCamera className="text-2xl" />
                      <span className="text-xs">사진 추가</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          pickPhoto(event.target.files?.[0], setFace);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && <div className="alert-error">{error}</div>}

          <button
            type="submit"
            disabled={completeMutation.isPending}
            className="btn-primary w-full"
          >
            {completeMutation.isPending ? "저장 중..." : "시작하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
