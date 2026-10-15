import { User } from "@supabase/supabase-js";

import { supabase } from "@/shared/supabase";

export const photoBucket =
  process.env.NEXT_PUBLIC_SUPABASE_PHOTO_BUCKET ?? "profile-photos";

export type ProfileRow = {
  user_id: string;
  name?: string | null;
  height?: string | null;
  age?: string | null;
  location?: string | null;
  hearts?: number | null;
  photos?: string[] | null;
  has_active_match?: boolean | null;
  gender?: string | null;
  mbti?: string | null;
  purpose?: string | null;
  photos_private?: boolean | null;
  onboarded_at?: string | null;
  trust_score?: number | null;
  introduction?: string | null;
};

export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

export async function requireUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user;
}

export async function getProfileRow(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();

  if (error) {
    throw error;
  }

  return data;
}

export function buildProfile(user: User, row?: ProfileRow | null) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  return {
    userId: user.id,
    name:
      row?.name ??
      (typeof metadata.name === "string" ? metadata.name : null) ??
      user.email?.split("@")[0] ??
      "",
    height:
      row?.height ?? (typeof metadata.height === "string" ? metadata.height : "") ?? "",
    age: row?.age ?? (typeof metadata.age === "string" ? metadata.age : "") ?? "",
    location:
      row?.location ??
      (typeof metadata.location === "string" ? metadata.location : "") ??
      "",
    hearts: row?.hearts ?? 0,
    photos: row?.photos ?? [],
    hasActiveMatch: row?.has_active_match ?? false,
    gender: row?.gender ?? "",
    mbti: row?.mbti ?? "",
    purpose: row?.purpose ?? "",
    photosPrivate: row?.photos_private ?? false,
    onboarded: Boolean(row?.onboarded_at),
    trustScore: row?.trust_score ?? 70,
    introduction: row?.introduction ?? "",
  };
}

export async function getProfileMap(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, ProfileRow>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("user_id", userIds);

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((profile) => [profile.user_id, profile as ProfileRow]));
}

export function extractStoragePath(publicUrl: string) {
  const marker = `/storage/v1/object/public/${photoBucket}/`;
  const index = publicUrl.indexOf(marker);
  return index >= 0 ? publicUrl.slice(index + marker.length) : publicUrl;
}
