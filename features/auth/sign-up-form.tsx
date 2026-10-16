"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCheckCircle } from "react-icons/fi";

import {
  useCompleteSignUpMutation,
  useRequestSignUpCodeMutation,
  useVerifySignUpCodeMutation,
} from "@/features/auth/hooks";

const RESEND_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 회원가입: 이메일 [인증 요청] → 메일로 받은 6자리 인증번호 [확인] → 비밀번호를 정하면 가입 완료
export default function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const requestMutation = useRequestSignUpCodeMutation();
  const verifyMutation = useVerifySignUpCodeMutation();
  const completeMutation = useCompleteSignUpMutation();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const trimmedEmail = email.trim().toLowerCase();

  const requestCode = async () => {
    setError(null);
    setInfo(null);
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError("이메일 형식을 확인해 주세요.");
      return;
    }
    try {
      await requestMutation.mutateAsync(trimmedEmail);
      setSentTo(trimmedEmail);
      setCode("");
      setCooldown(RESEND_SECONDS);
      setInfo(`${trimmedEmail}로 인증번호를 보냈어요. 메일이 안 보이면 스팸함도 확인해 주세요.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증번호를 보내지 못했어요.");
    }
  };

  const verifyCode = async () => {
    if (!sentTo) return;
    setError(null);
    try {
      await verifyMutation.mutateAsync({ email: sentTo, code });
      setVerified(true);
      setInfo(null);
    } catch (err) {
      setInfo(null);
      setError(err instanceof Error ? err.message : "인증에 실패했어요.");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!verified) {
      setError("이메일 인증을 먼저 해 주세요.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      await completeMutation.mutateAsync(password);
      router.replace("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입에 실패했어요.");
    }
  };

  return (
    <div className="app-frame flex min-h-screen items-center justify-center p-4">
      <div className="surface-panel w-full max-w-md">
        <p className="section-kicker">조각</p>
        <h1 className="section-title">회원가입</h1>
        <p className="section-copy">이메일 인증을 마치면 가입이 완료되고, 이어서 프로필을 설정합니다.</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="signup-email" className="label-text">
              아이디(이메일)
            </label>
            <div className="flex gap-2">
              <input
                id="signup-email"
                className="input-field min-w-0 flex-1"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={verified}
                autoComplete="email"
                required
              />
              <button
                type="button"
                onClick={() => void requestCode()}
                disabled={verified || requestMutation.isPending || cooldown > 0 || !email.trim()}
                className="btn-secondary mt-2 shrink-0 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
              >
                {requestMutation.isPending
                  ? "보내는 중..."
                  : cooldown > 0
                    ? `재요청 ${cooldown}초`
                    : sentTo
                      ? "재요청"
                      : "인증 요청"}
              </button>
            </div>
          </div>

          {sentTo && (
            <div>
              <label htmlFor="signup-code" className="label-text">
                인증번호
              </label>
              {verified ? (
                <p className="mt-2 flex items-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">
                  <FiCheckCircle className="shrink-0" />
                  이메일 인증이 완료됐어요.
                </p>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="signup-code"
                    className={`input-field min-w-0 flex-1 ${code ? "tracking-[0.3em]" : ""}`}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                    placeholder="6자리 숫자"
                  />
                  <button
                    type="button"
                    onClick={() => void verifyCode()}
                    disabled={code.length !== 6 || verifyMutation.isPending}
                    className="btn-primary mt-2 shrink-0 whitespace-nowrap"
                  >
                    {verifyMutation.isPending ? "확인 중..." : "확인"}
                  </button>
                </div>
              )}
            </div>
          )}

          <label className="label-text">
            비밀번호
            <input
              className="input-field"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="6자 이상"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </label>
          <label className="label-text">
            비밀번호 확인
            <input
              className="input-field"
              type="password"
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              minLength={6}
              autoComplete="new-password"
              required
            />
          </label>

          {info && <div className="alert-success break-keep">{info}</div>}
          {error && <div className="alert-error break-keep">{error}</div>}

          <button type="submit" disabled={!verified || completeMutation.isPending} className="btn-primary w-full">
            {completeMutation.isPending ? "가입 중..." : verified ? "회원가입" : "이메일 인증 후 가입할 수 있어요"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-400">
          이미 계정이 있나요?{" "}
          <Link href="/login" className="font-medium text-red-300 hover:text-red-200">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
