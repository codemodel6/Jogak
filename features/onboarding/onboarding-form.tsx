"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCamera, FiX } from "react-icons/fi";

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

const PHOTO_SLOT_COUNT = 3;
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
  const [photosPrivate, setPhotosPrivate] = useState(false);
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>(
    Array.from({ length: PHOTO_SLOT_COUNT }, () => null),
  );
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
      photoSlots.forEach((slot) => slot && URL.revokeObjectURL(slot.previewUrl));
    };
    // 언마운트 시 미리보기 URL만 정리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePhotoSelect = (index: number, file: File | undefined) => {
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
    setPhotoSlots((prev) => {
      const next = [...prev];
      const current = next[index];
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }
      next[index] = { file, previewUrl: URL.createObjectURL(file) };
      return next;
    });
  };

  const handlePhotoRemove = (index: number) => {
    setPhotoSlots((prev) => {
      const next = [...prev];
      const current = next[index];
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }
      next[index] = null;
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedNickname = nickname.trim();
    const photoFiles = photoSlots.flatMap((slot) => (slot ? [slot.file] : []));

    if (trimmedNickname.length < 2 || trimmedNickname.length > 12) {
      setError("닉네임은 2~12자로 입력해 주세요.");
      return;
    }
    if (!gender || !mbti || !purpose) {
      setError("성별, MBTI, 목적을 모두 선택해 주세요.");
      return;
    }
    if (!photosPrivate && photoFiles.length === 0) {
      setError("사진을 1장 이상 등록하거나 '사진 공개 안 할래요'를 켜 주세요.");
      return;
    }

    try {
      await completeMutation.mutateAsync({
        nickname: trimmedNickname,
        gender,
        height,
        mbti,
        purpose,
        photosPrivate,
        photoFiles,
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

          <div>
            <div className="flex items-center justify-between">
              <span className="label-text">사진 (최대 {PHOTO_SLOT_COUNT}장)</span>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                사진 공개 안 할래요
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={photosPrivate}
                  onChange={(event) => setPhotosPrivate(event.target.checked)}
                />
                <span className="relative h-6 w-11 rounded-full bg-white/12 transition after:absolute after:top-1 after:left-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:bg-violet-500 peer-checked:after:translate-x-5" />
              </label>
            </div>

            {!photosPrivate && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                {photoSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/4"
                  >
                    {slot ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={slot.previewUrl}
                          alt={`프로필 사진 ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handlePhotoRemove(index)}
                          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
                          aria-label={`사진 ${index + 1} 삭제`}
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
                            handlePhotoSelect(index, event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}
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
