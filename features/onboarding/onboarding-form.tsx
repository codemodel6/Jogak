"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiLock, FiPlus, FiX } from "react-icons/fi";

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

          {/* 사진 2칸: 같은 크기. 비어 있으면 + 로 올리고, 오른쪽 위 X 로 지운다 */}
          <div>
            <span className="label-text">사진</span>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <PhotoTile
                label="프로필 아이콘"
                hint="채팅에 보여요 · 선택"
                photo={avatar?.previewUrl}
                onPick={(file) => pickPhoto(file, setAvatar)}
                onClear={() => clearPhoto(setAvatar)}
              />
              <PhotoTile
                label="실물 사진"
                hint="매칭 확정 때만 공개"
                photo={face?.previewUrl}
                hidden={faceHidden}
                onPick={(file) => pickPhoto(file, setFace)}
                onClear={() => clearPhoto(setFace)}
              />
            </div>
            <label className="mt-2.5 flex cursor-pointer items-center justify-end gap-2 text-[0.8rem] text-zinc-300">
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

function PhotoTile({
  label,
  hint,
  photo,
  hidden = false,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  photo?: string;
  hidden?: boolean;
  onPick: (file: File | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[0.84rem] font-semibold text-white">{label}</p>
      <p className="truncate text-[0.72rem] text-zinc-500">{hint}</p>
      <div className="relative mt-1.5 aspect-[3/4] overflow-hidden rounded-2xl border border-dashed border-white/15 bg-white/4">
        {hidden ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-zinc-500">
            <FiLock className="text-[1.4rem]" />
            <span className="text-[0.76rem]">실물 비공개</span>
          </div>
        ) : photo ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt={label} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={onClear}
              className="keep-dark absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black/85"
              aria-label={`${label} 삭제`}
            >
              <FiX className="text-[1.05rem]" />
            </button>
          </>
        ) : (
          <label className="flex h-full w-full cursor-pointer items-center justify-center text-zinc-400 transition hover:text-zinc-200">
            <FiPlus className="text-[1.8rem]" aria-label={`${label} 추가`} />
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                onPick(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
