"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getPostLoginPath } from "@/features/auth/api";
import { useAuthStatusQuery } from "@/features/auth/hooks";

export default function RootPage() {
  const router = useRouter();
  const { data: isAuthenticated, isError } = useAuthStatusQuery();

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (isAuthenticated === true) {
        // 저장된 세션이 있으면 로그인 화면 없이 바로 진입
        try {
          router.replace(await getPostLoginPath());
        } catch {
          router.replace("/login");
        }
      } else if (isAuthenticated === false || isError) {
        router.replace("/login");
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [isAuthenticated, isError, router]);

  return (
    <div className="app-frame flex min-h-screen items-center justify-center px-6 text-white">
      <div className="surface-panel w-full max-w-2xl p-10 text-center">
        <Image
          src="/icons/icon-512.png"
          alt="조각"
          width={96}
          height={96}
          priority
          className="mx-auto mb-6 h-24 w-24 rounded-full object-cover shadow-[0_0_36px_rgba(139,92,246,0.32)]"
        />
        <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">조각</h1>
        <p className="mt-4 text-base text-zinc-300 md:text-lg">
          신뢰 기반 실시간 만남 경험으로 홈과 전반적인 화면 디자인을 새롭게 연결하고 있습니다.
        </p>
        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
          <span>서비스로 이동 중...</span>
        </div>
      </div>
    </div>
  );
}
