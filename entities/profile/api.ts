import { supabase } from "@/shared/supabase";
import {
  buildProfile,
  extractStoragePath,
  getProfileRow,
  facePhotoBucket,
  photoBucket,
  requireUser,
} from "@/shared/lib/supabase/helpers";

export async function getProfile() {
  const user = await requireUser();
  const row = await getProfileRow(user.id);

  return { profile: buildProfile(user, row) };
}

// 다른 사용자의 공개 프로필 (채팅에서 사진을 눌렀을 때 보여준다)
export async function getUserProfile(userId: string) {
  const row = await getProfileRow(userId);

  return {
    userId,
    name: row?.name ?? "익명",
    photos: row?.photos ?? [],
    gender: row?.gender ?? "",
    age: row?.age ?? "",
    height: row?.height ?? "",
    mbti: row?.mbti ?? "",
    trustScore: row?.trust_score ?? 70,
  };
}

export async function updateProfile(data: {
  name?: string;
  gender?: string;
  mbti?: string;
  purpose?: string;
  introduction?: string;
  height?: string;
  age?: string;
  location?: string;
}) {
  const user = await requireUser();

  // 넘겨받은 항목만 저장한다. 수정 화면에 없는 항목(예: 지역)은 기존 값을 그대로 둔다.
  const fields = Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;

  const { error } = await supabase.from("profiles").upsert(
    { user_id: user.id, ...fields },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }

  const { error: authError } = await supabase.auth.updateUser({ data: fields });

  if (authError) {
    throw authError;
  }

  return getProfile();
}

function fileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() || "jpg";
}

async function uploadAvatarFile(userId: string, file: File) {
  const filePath = `${userId}/avatar-${Date.now()}.${fileExtension(file)}`;
  const { error } = await supabase.storage
    .from(photoBucket)
    .upload(filePath, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return supabase.storage.from(photoBucket).getPublicUrl(filePath).data.publicUrl;
}

async function uploadFaceFile(userId: string, file: File) {
  const filePath = `${userId}/face-${Date.now()}.${fileExtension(file)}`;
  const { error } = await supabase.storage
    .from(facePhotoBucket)
    .upload(filePath, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return filePath;
}

// 프로필 아이콘 바꾸기(file) / 지우기(null) → 지우면 기본 이미지가 보인다
export async function setAvatar(file: File | null) {
  const user = await requireUser();
  const previous = (await getProfileRow(user.id))?.avatar_url;
  const avatarUrl = file ? await uploadAvatarFile(user.id, file) : null;

  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("user_id", user.id);
  if (error) throw error;

  // 새 사진 저장이 끝난 뒤 예전 파일을 지운다. 실패해도 변경은 끝난 상태다.
  if (previous) {
    await supabase.storage.from(photoBucket).remove([extractStoragePath(previous)]);
  }
}

// 실물 사진 바꾸기(file) / 등록 안 함(null)
export async function setFacePhoto(file: File | null) {
  const user = await requireUser();
  const previous = (await getProfileRow(user.id))?.face_photo_path;
  const facePath = file ? await uploadFaceFile(user.id, file) : null;

  const { error } = await supabase.from("profiles").update({ face_photo_path: facePath }).eq("user_id", user.id);
  if (error) throw error;

  if (previous) {
    await supabase.storage.from(facePhotoBucket).remove([previous]);
  }
}

// 실물 사진 보기용 링크(10분). 내 사진이거나, 매칭 확인 단계라 볼 수 있을 때만 만들어진다.
export async function getFacePhotoUrl(userId: string) {
  const row = await getProfileRow(userId);
  if (!row?.face_photo_path) {
    return null;
  }

  const { data, error } = await supabase.storage.from(facePhotoBucket).createSignedUrl(row.face_photo_path, 600);
  if (error) {
    return null;
  }
  return data.signedUrl;
}

// 신뢰 포인트로 신뢰 점수를 회복한다. 차감·증가는 DB 함수 하나에서 함께 처리된다.
// 신뢰 포인트 1개 = 1,000원. 신뢰 점수 1점 회복에 신뢰 포인트 1개.
export const TRUST_RECOVERY_COST_PER_SCORE = 1;

export async function recoverTrust(score: number) {
  const { error } = await supabase.rpc("recover_trust", { p_score: score });

  if (error) {
    throw new Error(error.message);
  }

  return getProfile();
}

export type OnboardingPayload = {
  nickname: string;
  gender: string;
  height: string;
  mbti: string;
  purpose: string;
  // 프로필 아이콘(선택) · 실물 사진(선택, '실물 등록 안 할래요'면 null)
  avatarFile: File | null;
  faceFile: File | null;
};

export async function completeOnboarding(data: OnboardingPayload) {
  const user = await requireUser();
  const avatarUrl = data.avatarFile ? await uploadAvatarFile(user.id, data.avatarFile) : null;
  const facePath = data.faceFile ? await uploadFaceFile(user.id, data.faceFile) : null;

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      name: data.nickname,
      gender: data.gender,
      height: data.height,
      mbti: data.mbti,
      purpose: data.purpose,
      photos_private: !data.faceFile,
      avatar_url: avatarUrl,
      face_photo_path: facePath,
      onboarded_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }

  return getProfile();
}
