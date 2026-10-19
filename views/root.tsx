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
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 animate-[splash-in_0.6s_ease-out_both]">
        <Image
          src="/icons/icon-512.png"
          alt="조각"
          width={88}
          height={88}
          priority
          className="h-22 w-22 rounded-[24px] object-cover"
        />
        <h1 className="text-2xl font-semibold tracking-tight text-white">조각</h1>
      </div>
    </div>
  );
}
