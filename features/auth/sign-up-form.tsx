"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { useSignUpMutation } from "@/features/auth/hooks";
import AlertModal from "@/shared/ui/alert-modal";

export default function SignUpForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const signUpMutation = useSignUpMutation();

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setApprovalModalOpen(false);

    if (formData.password !== formData.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      await signUpMutation.mutateAsync({
        email: formData.email,
        password: formData.password,
      });
      setApprovalModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원가입 실패");
    }
  };

  return (
    <>
      <div className="app-frame flex min-h-screen items-center justify-center p-4">
        <div className="surface-panel w-full max-w-md">
          <p className="section-kicker">조각</p>
          <h1 className="section-title">회원가입</h1>
          <p className="section-copy">
            이메일로 가입한 뒤 첫 로그인 때 프로필을 설정합니다.
          </p>

          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            <label className="label-text">
              이메일
              <input
                className="input-field"
                type="email"
                value={formData.email}
                onChange={(event) => handleChange("email", event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="label-text">
              비밀번호
              <input
                className="input-field"
                type="password"
                value={formData.password}
                onChange={(event) => handleChange("password", event.target.value)}
                placeholder="6자 이상"
                minLength={6}
                required
              />
            </label>
            <label className="label-text">
              비밀번호 확인
              <input
                className="input-field"
                type="password"
                value={formData.passwordConfirm}
                onChange={(event) => handleChange("passwordConfirm", event.target.value)}
                minLength={6}
                required
              />
            </label>

            {error && <div className="alert-error">{error}</div>}

            <button
              type="submit"
              disabled={signUpMutation.isPending}
              className="btn-primary w-full"
            >
              {signUpMutation.isPending ? "가입 중..." : "회원가입"}
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
      <AlertModal
        open={approvalModalOpen}
        title="승인 메일을 보냈습니다"
        description="입력한 이메일로 승인 요청 메일이 전송되었습니다. 메일을 확인해 승인한 뒤 로그인해 주세요."
        confirmLabel="로그인으로 이동"
        onConfirm={() => {
          setApprovalModalOpen(false);
          router.push("/login");
        }}
      />
    </>
  );
}
