import { supabase } from "@/shared/supabase";
import {
  buildProfile,
  extractStoragePath,
  getProfileRow,
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

export async function uploadPhoto(file: File) {
  const user = await requireUser();
  const filePath = `${user.id}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from(photoBucket)
    .upload(filePath, file, { upsert: false });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(photoBucket).getPublicUrl(filePath);
  const currentProfile = await getProfile();
  const photos = [...(currentProfile.profile.photos ?? []), publicUrl];

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      photos,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }

  return { photos };
}

export async function deletePhoto(index: number) {
  const user = await requireUser();
  const currentProfile = await getProfile();
  const photos = [...(currentProfile.profile.photos ?? [])];
  const [deletedPhoto] = photos.splice(index, 1);

  if (deletedPhoto) {
    const { error: storageError } = await supabase.storage
      .from(photoBucket)
      .remove([extractStoragePath(deletedPhoto)]);

    if (storageError) {
      throw storageError;
    }
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      photos,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }

  return { photos };
}

export async function replacePhoto(payload: { index: number; file: File }) {
  const user = await requireUser();
  const currentProfile = await getProfile();
  const photos = [...(currentProfile.profile.photos ?? [])];
  const previous = photos[payload.index];
  const extension = payload.file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filePath = `${user.id}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(photoBucket)
    .upload(filePath, payload.file, { upsert: false, contentType: payload.file.type });

  if (uploadError) {
    throw uploadError;
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(photoBucket).getPublicUrl(filePath);
  photos[payload.index] = publicUrl;

  const { error } = await supabase.from("profiles").upsert(
    { user_id: user.id, photos },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }

  // 새 사진 저장이 끝난 뒤에 예전 파일을 지운다. 지우기에 실패해도 사진 변경은 끝난 상태다.
  if (previous) {
    await supabase.storage.from(photoBucket).remove([extractStoragePath(previous)]);
  }

  return { photos };
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
  photosPrivate: boolean;
  photoFiles: File[];
};

export async function completeOnboarding(data: OnboardingPayload) {
  const user = await requireUser();
  const photos: string[] = [];

  if (!data.photosPrivate) {
    for (const [index, file] of data.photoFiles.entries()) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${user.id}/${Date.now()}-${index}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(photoBucket)
        .upload(filePath, file, { upsert: false, contentType: file.type });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(photoBucket).getPublicUrl(filePath);
      photos.push(publicUrl);
    }
  }

  const { error } = await supabase.from("profiles").upsert(
    {
      user_id: user.id,
      name: data.nickname,
      gender: data.gender,
      height: data.height,
      mbti: data.mbti,
      purpose: data.purpose,
      photos_private: data.photosPrivate,
      photos,
      onboarded_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw error;
  }

  return getProfile();
}
