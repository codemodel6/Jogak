import { disablePush } from "@/shared/lib/push/push";
import { supabase } from "@/shared/supabase";
import {
  getCurrentSession,
  getProfileRow,
  requireUser,
} from "@/shared/lib/supabase/helpers";

export async function getAuthStatus() {
  const session = await getCurrentSession();
  return Boolean(session?.user?.id);
}

export async function getCurrentUserId() {
  const session = await getCurrentSession();
  return session?.user?.id ?? null;
}

export async function signInWithPassword(payload: {
  email: string;
  password: string;
}) {
  const { error } = await supabase.auth.signInWithPassword(payload);

  if (error) {
    throw error;
  }
}

export async function signUpWithPassword(payload: {
  email: string;
  password: string;
}) {
  const { error } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
    },
  });

  if (error) {
    throw error;
  }
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });

  if (error) {
    throw error;
  }
}

// 로그인 직후 이동할 곳: 프로필 입력을 마치지 않았으면 온보딩, 마쳤으면 홈
export async function getPostLoginPath() {
  const user = await requireUser();
  const row = await getProfileRow(user.id);

  return row?.onboarded_at ? "/home" : "/onboarding";
}

export async function signOut() {
  // 로그아웃한 기기로는 더 이상 알림이 가지 않게 이 기기의 구독을 먼저 지운다
  await disablePush().catch(() => undefined);
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  return requireUser();
}
