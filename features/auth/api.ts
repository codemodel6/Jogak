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

// 회원가입 1단계: 이메일로 6자리 인증번호를 보낸다 (이미 가입을 마친 이메일이면 막는다)
export async function requestSignUpCode(email: string) {
  const { data: registered, error: checkError } = await supabase.rpc("is_email_registered", { p_email: email });
  if (checkError) {
    throw checkError;
  }
  if (registered) {
    throw new Error("이미 가입된 이메일이에요. 로그인해 주세요.");
  }

  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    throw new Error(
      error.status === 429 ? "인증 메일을 너무 자주 요청했어요. 잠시 뒤 다시 시도해 주세요." : error.message,
    );
  }
}

// 2단계: 인증번호 확인 (맞으면 이 기기에 로그인된다)
export async function verifySignUpCode(payload: { email: string; code: string }) {
  const { error } = await supabase.auth.verifyOtp({ email: payload.email, token: payload.code, type: "email" });
  if (error) {
    throw new Error("인증번호가 맞지 않거나 시간이 지났어요.");
  }
}

// 3단계: 비밀번호를 정하면 가입 완료 (password_set: 가입을 마친 계정 표시, is_email_registered가 본다)
export async function completeSignUp(password: string) {
  const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } });
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
