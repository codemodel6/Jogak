"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { ChangeEvent, ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  FiCalendar,
  FiCamera,
  FiChevronDown,
  FiChevronRight,
  FiFlag,
  FiMessageCircle,
  FiMoreHorizontal,
  FiHeart,
  FiMinus,
  FiPlus,
  FiRefreshCw,
  FiSettings,
  FiStar,
  FiTrendingUp,
  FiUser,
  FiUsers,
  FiX,
} from "react-icons/fi";

import { useMyActivityQuery } from "@/entities/activity/hooks";
import type { Profile } from "@/entities/profile";
import {
  useDeletePhotoMutation,
  useProfileQuery,
  useRecoverTrustMutation,
  useReplacePhotoMutation,
  useUpdateProfileMutation,
  useUploadPhotoMutation,
} from "@/entities/profile/hooks";
import { TRUST_RECOVERY_COST_PER_SCORE } from "@/entities/profile/api";
import { useAuthStatusQuery } from "@/features/auth/hooks";
import { TRUST_GRADES, estimateTopPercent, getTrustGrade } from "@/shared/lib/trust";
import Skeleton from "@/shared/ui/skeleton";
import TrustCrystalIcon from "@/shared/ui/trust-crystal-icon";
import TrustGradeEmblem from "@/shared/ui/trust-grade-emblem";
import MainLayout from "@/widgets/main-layout";

type EditableProfile = {
  name: string;
  gender: string;
  age: string;
  height: string;
  mbti: string;
  purpose: string;
  introduction: string;
};

type ProfileRow = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  // 수정 가능한 항목만 지정한다. 없으면 수정 중에도 글자로 보인다.
  editKey?: keyof EditableProfile;
  options?: string[];
  suffix?: string;
};

const MAX_PHOTOS = 3;
const MAX_INTRO_LENGTH = 20;
// 온보딩에서 고르는 목적과 같은 목록
const PURPOSE_OPTIONS = ["재미", "헌팅", "친목", "진지한 만남", "술 한잔", "대화 상대"];

const MBTI_OPTIONS = [
  "ISTJ", "ISFJ", "INFJ", "INTJ", "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP", "ESTJ", "ESFJ", "ENFJ", "ENTJ",
];

type StatCard = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accentClassName: string;
  href?: string;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getInitials(name: string) {
  return name.slice(0, 2);
}

function createEditableProfile(profile: Profile | null): EditableProfile {
  return {
    name: profile?.name ?? "",
    age: profile?.age ?? "",
    gender: profile?.gender ?? "",
    height: profile?.height ?? "",
    mbti: profile?.mbti ?? "",
    purpose: profile?.purpose ?? "",
    introduction: profile?.introduction ?? "",
  };
}

function ProfileAvatar({
  name,
  photo,
  sizeClassName,
}: {
  name: string;
  photo?: string;
  sizeClassName: string;
}) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={`${name} 프로필 사진`}
        className={cx("rounded-full border border-white/10 object-cover", sizeClassName)}
      />
    );
  }

  return (
    <div
      className={cx(
        "flex items-center justify-center rounded-full border border-white/10 bg-[linear-gradient(135deg,#2b3154,#171b32)] text-white shadow-[0_18px_40px_rgba(0,0,0,0.22)]",
        sizeClassName,
      )}
    >
      <span className="text-[1.4rem] font-semibold tracking-[-0.04em]">{getInitials(name)}</span>
    </div>
  );
}

function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[1.15rem] font-semibold text-white md:text-[1.3rem]">{title}</h2>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-1 text-sm font-medium text-violet-300 transition hover:text-violet-200"
        >
          {actionLabel}
          <FiChevronRight className="text-base" />
        </button>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<EditableProfile>({
    name: "",
    age: "",
    gender: "",
    height: "",
    mbti: "",
    purpose: "",
    introduction: "",
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { data: isAuthenticated } = useAuthStatusQuery();
  const queryEnabled = isAuthenticated === true;
  const profileQuery = useProfileQuery(queryEnabled);
  const activityQuery = useMyActivityQuery(queryEnabled);
  // 서버 화면과 브라우저 첫 화면을 같게(스켈레톤) 그린다
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const updateProfileMutation = useUpdateProfileMutation();
  const uploadPhotoMutation = useUploadPhotoMutation();
  const deletePhotoMutation = useDeletePhotoMutation();
  const replacePhotoMutation = useReplacePhotoMutation();
  const [photoManagerOpen, setPhotoManagerOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryScore, setRecoveryScore] = useState(1);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const recoverTrustMutation = useRecoverTrustMutation();
  const [photoTarget, setPhotoTarget] = useState<number | "add" | null>(null);

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  const profile = profileQuery.data?.profile ?? null;

  useEffect(() => {
    if (!editing) {
      setEditedProfile(createEditableProfile(profile));
    }
  }, [editing, profile]);

  const displayName = (profile?.name ?? "").trim() || "이름 없음";
  const displayAge = (profile?.age ?? "").trim();
  const displayHeight = (profile?.height ?? "").trim();
  const displayPhoto = profile?.photos?.[0];
  const trustPoints = profile?.hearts ?? 0;
  const trustScore = profile?.trustScore ?? 70;
  // 실제 순위 집계 전까지는 신뢰 점수로 상위 %를 추정한다 (100점 = 상위 1%, 70점 = 상위 30%).
  // 회원이 쌓이면 이 값만 DB 순위 집계로 바꾸면 등급·막대가 그대로 따라간다.
  const trustTopPercent = estimateTopPercent(trustScore);
  const { grade: trustGrade } = getTrustGrade(trustTopPercent);
  // 막대 칸 폭은 barWidth(블랙은 실제 5%보다 넓게, 그래도 가장 좁게), 점은 현재 등급 칸 안에서 순위 비율만큼 이동한다.
  const trustGradeIndex = TRUST_GRADES.indexOf(trustGrade);
  const trustGradeStart = TRUST_GRADES.slice(0, trustGradeIndex).reduce((sum, grade) => sum + grade.barWidth, 0);
  const trustGradeFloor = TRUST_GRADES[trustGradeIndex + 1]?.maxTop ?? 0;
  const trustPosition =
    trustGradeStart +
    (trustGrade.barWidth * (trustGrade.maxTop - trustTopPercent)) / (trustGrade.maxTop - trustGradeFloor);

  const profileRows: ProfileRow[] = [
    { icon: FiUser, label: "닉네임", value: displayName, editKey: "name" },
    { icon: FiUsers, label: "성별", value: profile?.gender || "-", editKey: "gender", options: ["남성", "여성"] },
    { icon: FiCalendar, label: "나이", value: displayAge ? `${displayAge}세` : "-", editKey: "age", suffix: "세" },
    {
      icon: FiTrendingUp,
      label: "키",
      value: displayHeight ? `${displayHeight.replace(/cm$/, "")}cm` : "-",
      editKey: "height",
      suffix: "cm",
    },
    { icon: FiSmilePlaceholder, label: "MBTI", value: profile?.mbti || "-", editKey: "mbti", options: MBTI_OPTIONS },
    { icon: FiHeart, label: "목적", value: profile?.purpose || "-", editKey: "purpose", options: PURPOSE_OPTIONS },
  ];

  const introduction = profile?.introduction ?? "";

  const queryError =
    profileQuery.error instanceof Error
      ? profileQuery.error.message
      : profileQuery.error
        ? "내 정보를 불러오지 못했습니다."
        : null;
  const error = actionError ?? queryError;

  const handleStartEditing = () => {
    setEditedProfile(createEditableProfile(profile));
    setSuccessMessage(null);
    setActionError(null);
    setEditing(true);
  };

  const handleCancelEditing = () => {
    setEditedProfile(createEditableProfile(profile));
    setActionError(null);
    setEditing(false);
  };

  const handleSave = async () => {
    try {
      await updateProfileMutation.mutateAsync(editedProfile);
      setEditing(false);
      setActionError(null);
      setSuccessMessage("프로필 정보를 저장했습니다.");
    } catch (err) {
      setSuccessMessage(null);
      setActionError(err instanceof Error ? err.message : "프로필 저장에 실패했습니다.");
    }
  };

  const photos = profile?.photos ?? [];

  const openPhotoPicker = (target: number | "add") => {
    setPhotoTarget(target);
    fileInputRef.current?.click();
  };

  const handlePhotoFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || photoTarget === null) {
      return;
    }

    try {
      if (photoTarget === "add") {
        await uploadPhotoMutation.mutateAsync(file);
      } else {
        await replacePhotoMutation.mutateAsync({ index: photoTarget, file });
      }
      setSuccessMessage("프로필 사진을 저장했습니다.");
      setActionError(null);
    } catch (err) {
      setSuccessMessage(null);
      setActionError(err instanceof Error ? err.message : "사진 저장에 실패했습니다.");
    } finally {
      setPhotoTarget(null);
    }
  };

  const handlePhotoDelete = async (index: number) => {
    try {
      await deletePhotoMutation.mutateAsync(index);
      setSuccessMessage("프로필 사진을 삭제했습니다.");
      setActionError(null);
    } catch (err) {
      setSuccessMessage(null);
      setActionError(err instanceof Error ? err.message : "사진 삭제에 실패했습니다.");
    }
  };

  const maxRecoverable = Math.max(0, 100 - trustScore);
  const affordable = Math.floor(trustPoints / TRUST_RECOVERY_COST_PER_SCORE);
  const recoveryLimit = Math.min(maxRecoverable, affordable);
  const recoveryCost = recoveryScore * TRUST_RECOVERY_COST_PER_SCORE;

  const openRecovery = () => {
    setRecoveryScore(Math.min(5, Math.max(1, recoveryLimit)));
    setRecoveryError(null);
    setRecoveryOpen(true);
  };

  const changeRecoveryScore = (value: number) => {
    setRecoveryError(null);
    setRecoveryScore(Math.max(1, Math.min(value, Math.max(1, maxRecoverable))));
  };

  const handleRecoverTrust = async () => {
    try {
      await recoverTrustMutation.mutateAsync(recoveryScore);
      setRecoveryOpen(false);
      setActionError(null);
      setSuccessMessage(`신뢰 점수 ${recoveryScore}점을 회복했습니다.`);
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : "신뢰 회복에 실패했습니다.");
    }
  };

  // 활동 통계는 내 활동 화면과 같은 실제 집계를 쓴다
  const activity = activityQuery.data;
  const statCards: StatCard[] | null = activity
    ? [
        { icon: FiUsers, label: "매칭 성공", value: `${activity.metCount}건`, accentClassName: "text-violet-400", href: "/activity" },
        { icon: FiMessageCircle, label: "받은 후기", value: `${activity.reviewCount}개`, accentClassName: "text-violet-400", href: "/reviews?tab=received" },
        {
          icon: FiMoreHorizontal,
          label: "응답률",
          value: activity.responseRate === null ? "-" : `${activity.responseRate}%`,
          accentClassName: "text-indigo-400",
          href: "/activity",
        },
        {
          icon: FiStar,
          label: "평균 평점",
          value: activity.averageRating === null ? "-" : `${activity.averageRating.toFixed(1)} / 5.0`,
          accentClassName: "text-amber-400",
          href: "/reviews?tab=received",
        },
      ]
    : null;

  const photoBusy =
    uploadPhotoMutation.isPending || replacePhotoMutation.isPending || deletePhotoMutation.isPending;

  if (!mounted || (profileQuery.isPending && !profile)) {
    return (
      <MainLayout active="profile" title="내 정보" copy="회원님의 정보를 확인하고 관리하세요.">
        <div className="mt-5 flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="surface-panel flex items-center gap-5 px-5 py-6">
              <Skeleton className="h-24 w-24 shrink-0 rounded-full md:h-28 md:w-28" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-8 w-40 rounded-md" />
                <Skeleton className="h-4 w-56 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-[320px] rounded-[22px]" />
          </div>
          <div className="flex min-w-0 flex-col gap-5">
            <Skeleton className="h-[180px] rounded-[22px]" />
            <Skeleton className="h-[220px] rounded-[22px]" />
          </div>
        </div>
      </MainLayout>
    );
  }

  // 모바일에서는 한 열로 order 순서대로, PC에서는 가운데 열과 오른쪽 단으로 나뉜다.
  return (
    <MainLayout
      active="profile"
      title="내 정보"
      copy="회원님의 정보를 확인하고 관리하세요."
      headerActions={
        <Link
          href="/settings"
          aria-label="설정"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:bg-white/10"
        >
          <FiSettings className="text-[1.2rem]" />
        </Link>
      }
    >
      {(error || successMessage) && (
        <div className="pt-4">
          {error && <div className="alert-error">{error}</div>}
          {!error && successMessage && <div className="alert-success">{successMessage}</div>}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-5 xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="contents xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
        <section className="surface-panel order-1 overflow-hidden p-0 xl:order-none">
          <div className="relative overflow-hidden px-5 py-6 md:px-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(124,92,255,0.22),transparent_45%)]" />
            <div className="relative flex items-center gap-5 md:gap-6">
              <button
                type="button"
                onClick={() => setPhotoManagerOpen(true)}
                aria-label="사진 변경"
                className="group relative shrink-0 rounded-full shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
              >
                <ProfileAvatar name={displayName} photo={displayPhoto} sizeClassName="h-24 w-24 md:h-28 md:w-28" />
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-black/55 text-[0.75rem] font-medium text-white opacity-0 transition group-hover:opacity-100">
                  <FiCamera className="text-[1.1rem]" />
                  사진 변경
                </span>
                <span className="absolute bottom-1 right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0d1124] bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] text-white">
                  <FiCamera className="text-[0.85rem]" />
                </span>
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[1.7rem] font-semibold leading-none tracking-[-0.04em] text-white md:text-[2rem]">
                    {displayName}
                  </h2>
                </div>
                <div className="mt-3 flex gap-2.5">
                  <span className="mt-0.5 w-[3px] shrink-0 self-stretch rounded-full bg-[linear-gradient(180deg,#8b6cff,rgba(139,108,255,0.1))]" />
                  {editing ? (
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        className="w-full max-w-[22rem] border-0 border-b border-dashed border-violet-400/50 bg-transparent px-0 py-0 text-[0.95rem] leading-6 text-zinc-100 placeholder:text-zinc-500 focus:border-violet-300 focus:outline-none"
                        value={editedProfile.introduction}
                        maxLength={MAX_INTRO_LENGTH}
                        placeholder="상태 메시지를 입력하세요"
                        onChange={(event) =>
                          setEditedProfile((prev) => ({
                            ...prev,
                            introduction: event.target.value.slice(0, MAX_INTRO_LENGTH),
                          }))
                        }
                      />
                      <span className="shrink-0 text-[0.75rem] text-zinc-500">
                        {editedProfile.introduction.length}/{MAX_INTRO_LENGTH}
                      </span>
                    </div>
                  ) : (
                    <p className={cx("break-keep text-[0.95rem] leading-6", introduction ? "text-zinc-200" : "text-zinc-500")}>
                      {introduction || "상태 메시지가 없어요"}
                    </p>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* 프로필 정보: 수정 중에도 줄 높이·배치는 그대로, 값 글자만 밑줄 입력 칸으로 바뀐다 */}
          <div className="border-t border-white/8 px-5 py-5 md:px-6">
            <div className="flex h-8 items-center justify-between gap-3">
              <h2 className="text-[1.15rem] font-semibold text-white md:text-[1.3rem]">프로필 정보</h2>
              {editing ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEditing}
                    className="h-8 rounded-[10px] px-3.5 text-[0.8rem] font-medium transition border border-white/12 text-zinc-200 hover:bg-white/6"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={updateProfileMutation.isPending}
                    className="h-8 rounded-[10px] px-3.5 text-[0.8rem] font-medium transition bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] text-white hover:brightness-110 disabled:opacity-60"
                  >
                    {updateProfileMutation.isPending ? "저장 중..." : "저장"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleStartEditing}
                  className="h-8 rounded-[10px] px-3.5 text-[0.8rem] font-medium transition bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] text-white hover:brightness-110"
                >
                  수정
                </button>
              )}
            </div>
            <div className="mt-3 space-y-3">
              {profileRows.map((row, index) => {
                const Icon = row.icon;
                const editKey = row.editKey;

                return (
                  <div
                    key={row.label}
                    className={cx(
                      "grid items-center gap-1.5 border-white/8 pb-3 md:grid-cols-[132px_minmax(0,1fr)] md:gap-2",
                      index < profileRows.length - 1 && "border-b",
                    )}
                  >
                    <div className="flex items-center gap-3 text-zinc-300">
                      <Icon className="text-[1.15rem] text-violet-400" />
                      <span className="text-[0.92rem]">{row.label}</span>
                    </div>
                    {editing && editKey ? (
                      <div className="flex h-6 items-center gap-1.5">
                        {row.options ? (
                          <select
                            className="w-36 appearance-none bg-transparent border-0 border-b border-dashed border-violet-400/50 px-0 py-0 text-[0.95rem] leading-6 text-zinc-100 focus:border-violet-300 focus:outline-none [&>option]:bg-[#141833]"
                            value={editedProfile[editKey]}
                            onChange={(event) =>
                              setEditedProfile((prev) => ({ ...prev, [editKey]: event.target.value }))
                            }
                          >
                            <option value="">선택 안 함</option>
                            {row.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className={cx(row.suffix ? "w-16" : "w-40", "bg-transparent border-0 border-b border-dashed border-violet-400/50 px-0 py-0 text-[0.95rem] leading-6 text-zinc-100 focus:border-violet-300 focus:outline-none")}
                            value={editedProfile[editKey]}
                            inputMode={row.suffix ? "numeric" : undefined}
                            onChange={(event) =>
                              setEditedProfile((prev) => ({ ...prev, [editKey]: event.target.value }))
                            }
                          />
                        )}
                        {row.suffix && <span className="text-[0.95rem] text-zinc-400">{row.suffix}</span>}
                        {row.options && <FiChevronDown className="-ml-5 pointer-events-none text-zinc-400" />}
                      </div>
                    ) : (
                      <p className="break-keep text-[0.95rem] leading-6 text-zinc-100">{row.value}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 신뢰: 등급은 신뢰 점수 순위(상위 %)에서 자동으로 정해진다 */}
        <section className="surface-panel order-2 overflow-hidden xl:order-none">
          <div className="flex items-center justify-between">
            <h2 className="text-[1.15rem] font-semibold text-white md:text-[1.3rem]">신뢰 등급</h2>
            <button
              type="button"
              onClick={openRecovery}
              className="flex h-8 items-center gap-1.5 rounded-[10px] bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] px-3.5 text-[0.8rem] font-medium text-white transition hover:brightness-110"
            >
              <FiRefreshCw className="text-[0.85rem]" />
              신뢰 회복
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
            <div className="flex shrink-0 items-center gap-4">
              <TrustGradeEmblem topPercent={trustTopPercent} />
              <div className="min-w-0">
                <p className={cx("text-[1.45rem] font-bold leading-tight tracking-[-0.04em]", trustGrade.className)}>
                  {trustGrade.name}
                </p>
                <p className="mt-1 text-[0.82rem] text-zinc-400">
                  상위 {trustTopPercent}% · 신뢰 점수 <span className="font-semibold text-white">{trustScore}점</span>
                </p>
              </div>
            </div>

            {/* 등급 구간을 칸으로 나누고(블랙은 상위 5%라 가장 좁다), 현재 순위 위치에 점을 찍는다 */}
            <div className="min-w-0 flex-1">
              <div className="relative h-2.5 rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#7d55ff,#8156f4,#5940d8)]"
                  style={{ width: `${trustPosition}%` }}
                />
                {TRUST_GRADES.slice(1).map((grade, index) => (
                  <span
                    key={grade.name}
                    className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/25"
                    style={{
                      left: `${TRUST_GRADES.slice(0, index + 1).reduce((sum, item) => sum + item.barWidth, 0)}%`,
                    }}
                  />
                ))}
                <span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(139,108,255,0.8)]"
                  style={{ left: `${trustPosition}%` }}
                />
              </div>
              <div className="mt-2.5 flex text-[0.72rem]">
                {TRUST_GRADES.map((grade, index) => {
                  const current = grade.name === trustGrade.name;
                  const isLast = index === TRUST_GRADES.length - 1;

                  return (
                    <span
                      key={grade.name}
                      className={cx(
                        "whitespace-nowrap",
                        // 등급 이름은 각 구간 시작 눈금에 맞춘다. 블랙 칸은 5%로 좁아서 칸 오른쪽 끝에 맞춘다.
                        isLast ? "flex justify-end" : "truncate pl-1.5 text-left",
                        current ? cx("font-semibold", grade.className) : "text-zinc-500",
                      )}
                      style={{ width: `${grade.barWidth}%` }}
                    >
                      {grade.name === "다이아몬드" ? (
                        <>
                          <span className="sm:hidden">다이아</span>
                          <span className="hidden sm:inline">다이아몬드</span>
                        </>
                      ) : (
                        grade.name
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
        </div>

        <div className="contents xl:sticky xl:top-5 xl:flex xl:min-w-0 xl:flex-col xl:gap-5">
          <section className="surface-panel order-3 xl:order-none">
            <div>
              <p className="text-[0.95rem] text-zinc-300">신뢰 포인트</p>
              <div className="mt-2.5 flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-[16px] bg-[radial-gradient(circle_at_50%_30%,rgba(196,181,253,0.35),transparent_60%),linear-gradient(150deg,#241c46,#120d2a_60%,#0a0718)] shadow-[0_0_0_1px_rgba(196,181,253,0.25),0_12px_28px_rgba(109,77,255,0.35)]">
                  <TrustCrystalIcon className="relative h-9 w-auto drop-shadow-[0_0_8px_rgba(167,139,250,0.75)]" />
                </div>
                <p className="text-[1.8rem] font-semibold leading-none tracking-[-0.05em] text-white">
                  {trustPoints.toLocaleString()}
                </p>
              </div>
              <Link
                href="/points"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-[rgba(109,89,255,0.16)] px-4 py-2 text-[0.85rem] font-medium text-white transition hover:bg-[rgba(109,89,255,0.26)]"
              >
                내역 확인
                <FiChevronRight />
              </Link>
            </div>
          </section>

          <section className="surface-panel order-4 xl:order-none">
            <SectionHeader title="활동 통계" />
            <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4 xl:grid-cols-2">
              {!statCards &&
                Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-[92px] rounded-[16px]" />)}
              {statCards?.map((stat) => {
                const Icon = stat.icon;

                return (
                  <Link
                    key={stat.label}
                    href={stat.href ?? "/activity"}
                    className="surface-panel-soft block px-2 py-3 text-center transition hover:bg-white/6"
                  >
                    <Icon className={cx("mx-auto text-[1.2rem]", stat.accentClassName)} />
                    <p className="mt-1.5 text-[0.8rem] text-zinc-300">{stat.label}</p>
                    <p className="mt-1.5 text-[1.2rem] font-semibold leading-none tracking-[-0.04em] text-white">
                      {stat.value}
                    </p>
                  </Link>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <Link
                href="/reviews"
                className="flex items-center justify-center gap-1.5 rounded-[12px] bg-[rgba(109,89,255,0.16)] px-4 py-2.5 text-[0.85rem] font-medium text-white transition hover:bg-[rgba(109,89,255,0.26)]"
              >
                나의 후기
                <FiChevronRight />
              </Link>
              <Link
                href="/activity"
                className="flex items-center justify-center gap-1.5 rounded-[12px] bg-white/6 px-4 py-2.5 text-[0.85rem] font-medium text-white transition hover:bg-white/10"
              >
                내 활동
                <FiChevronRight />
              </Link>
            </div>
          </section>
        </div>
      </div>

      {recoveryOpen && (
        <div className="modal-overlay" onClick={() => !recoverTrustMutation.isPending && setRecoveryOpen(false)}>
          <div className="modal-card max-w-md" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[1.2rem] font-semibold text-white">신뢰 회복</h3>
              <button
                type="button"
                onClick={() => setRecoveryOpen(false)}
                disabled={recoverTrustMutation.isPending}
                aria-label="닫기"
                className="text-zinc-300 hover:text-white"
              >
                <FiX className="text-[1.3rem]" />
              </button>
            </div>
            <p className="mt-1.5 break-keep text-[0.84rem] text-zinc-400">
              신뢰 포인트로 신뢰 점수를 회복할 수 있어요. 1점에 신뢰 포인트 {TRUST_RECOVERY_COST_PER_SCORE}개가 사용돼요.
            </p>

            {maxRecoverable === 0 ? (
              <p className="mt-6 rounded-[14px] bg-white/4 px-4 py-5 text-center text-[0.9rem] text-zinc-200">
                이미 최고 점수(100점)예요.
              </p>
            ) : (
              <>
                <div className="mt-5 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => changeRecoveryScore(recoveryScore - 1)}
                    disabled={recoveryScore <= 1}
                    aria-label="1점 줄이기"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white transition hover:bg-white/8 disabled:opacity-30"
                  >
                    <FiMinus />
                  </button>
                  <p className="w-28 text-center text-[2.2rem] font-semibold leading-none tracking-[-0.05em] text-white">
                    +{recoveryScore}
                    <span className="ml-1 text-[1rem]">점</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => changeRecoveryScore(recoveryScore + 1)}
                    disabled={recoveryScore >= maxRecoverable}
                    aria-label="1점 늘리기"
                    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white transition hover:bg-white/8 disabled:opacity-30"
                  >
                    <FiPlus />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2">
                  {[1, 5, 10].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => changeRecoveryScore(value)}
                      disabled={value > maxRecoverable}
                      className={cx(
                        "rounded-[10px] border py-2 text-[0.82rem] font-medium transition disabled:opacity-30",
                        recoveryScore === value
                          ? "border-violet-400/60 bg-violet-500/20 text-white"
                          : "border-white/8 bg-white/3 text-zinc-300 hover:border-white/20",
                      )}
                    >
                      +{value}점
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => changeRecoveryScore(maxRecoverable)}
                    className={cx(
                      "rounded-[10px] border py-2 text-[0.82rem] font-medium transition",
                      recoveryScore === maxRecoverable
                        ? "border-violet-400/60 bg-violet-500/20 text-white"
                        : "border-white/8 bg-white/3 text-zinc-300 hover:border-white/20",
                    )}
                  >
                    최대
                  </button>
                </div>

                <dl className="mt-5 space-y-2 rounded-[14px] bg-white/4 px-4 py-3.5 text-[0.88rem]">
                  <div className="flex justify-between text-zinc-300">
                    <dt>신뢰 점수</dt>
                    <dd>
                      {trustScore}점 <span className="text-zinc-500">→</span>{" "}
                      <span className="font-semibold text-white">{trustScore + recoveryScore}점</span>
                    </dd>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <dt>사용 포인트</dt>
                    <dd className="font-semibold text-violet-200">{recoveryCost.toLocaleString()}</dd>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <dt>남는 포인트</dt>
                    <dd className={trustPoints - recoveryCost < 0 ? "text-rose-300" : "text-white"}>
                      {(trustPoints - recoveryCost).toLocaleString()}
                    </dd>
                  </div>
                </dl>

                {recoveryScore > recoveryLimit && (
                  <p className="mt-3 flex items-center justify-between gap-3 text-[0.82rem] text-rose-300">
                    신뢰 포인트가 부족해요.
                    <Link href="/points" className="font-medium text-violet-300 hover:text-violet-200">
                      충전하기
                    </Link>
                  </p>
                )}
                {recoveryError && <div className="alert-error mt-3">{recoveryError}</div>}

                <button
                  type="button"
                  onClick={() => void handleRecoverTrust()}
                  disabled={recoverTrustMutation.isPending || recoveryScore > recoveryLimit}
                  className="btn-primary mt-5 w-full py-3"
                >
                  {recoverTrustMutation.isPending
                    ? "회복하는 중..."
                    : `신뢰 포인트 ${recoveryCost.toLocaleString()}개로 ${recoveryScore}점 회복하기`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {photoManagerOpen && (
        <div className="modal-overlay" onClick={() => !photoBusy && setPhotoManagerOpen(false)}>
          <div className="modal-card max-w-lg" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-[1.2rem] font-semibold text-white">사진 변경</h3>
              <button
                type="button"
                onClick={() => setPhotoManagerOpen(false)}
                disabled={photoBusy}
                aria-label="닫기"
                className="text-zinc-300 hover:text-white"
              >
                <FiX className="text-[1.3rem]" />
              </button>
            </div>
            <p className="mt-1.5 text-[0.84rem] text-zinc-400">
              최대 {MAX_PHOTOS}장까지 등록할 수 있어요. 첫 번째 사진이 대표 사진으로 보여요.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {Array.from({ length: MAX_PHOTOS }, (_, index) => {
                const photo = photos[index];

                return photo ? (
                  <div key={index} className="flex flex-col gap-2">
                    <div className="relative aspect-[3/4] overflow-hidden rounded-[16px] border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt={`프로필 사진 ${index + 1}`} className="h-full w-full object-cover" />
                      {index === 0 && (
                        <span className="absolute left-2 top-2 rounded-full bg-violet-500/90 px-2 py-0.5 text-[0.68rem] font-semibold text-white">
                          대표
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => openPhotoPicker(index)}
                        disabled={photoBusy}
                        className="rounded-[10px] border border-white/10 py-1.5 text-[0.78rem] font-medium text-white transition hover:bg-white/8 disabled:opacity-50"
                      >
                        변경
                      </button>
                      <button
                        type="button"
                        onClick={() => void handlePhotoDelete(index)}
                        disabled={photoBusy}
                        className="rounded-[10px] border border-rose-400/20 py-1.5 text-[0.78rem] font-medium text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    key={index}
                    type="button"
                    onClick={() => openPhotoPicker("add")}
                    disabled={photoBusy || index !== photos.length}
                    className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-white/15 bg-white/3 text-zinc-400 transition hover:text-zinc-200 disabled:opacity-40"
                  >
                    <FiPlus className="text-[1.4rem]" />
                    <span className="text-[0.8rem]">사진 추가</span>
                  </button>
                );
              })}
            </div>

            {photoBusy && <p className="mt-4 text-center text-[0.84rem] text-violet-200">사진을 저장하는 중입니다...</p>}
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoFile} className="hidden" />
    </MainLayout>
  );
}

function FiSmilePlaceholder({ className }: { className?: string }) {
  return <FiFlag className={className} />;
}
