"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FiBell,
  FiFileText,
  FiHeart,
  FiHome,
  FiLogOut,
  FiMenu,
  FiMessageCircle,
  FiUser,
} from "react-icons/fi";

import { useSignOutMutation } from "@/features/auth/hooks";

type AppShellProps = {
  children: ReactNode;
  trust?: number;
};

const navItems = [
  { href: "/home", label: "홈", icon: FiHome },
  { href: "/matching", label: "매칭", icon: FiHeart },
  { href: "/chats", label: "채팅", icon: FiMessageCircle },
  { href: "/notices", label: "공지사항", icon: FiFileText },
  { href: "/profile", label: "마이", icon: FiUser },
];

export default function AppShell({ children, trust }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const signOutMutation = useSignOutMutation();

  const handleLogout = async () => {
    try {
      await signOutMutation.mutateAsync();
    } finally {
      router.push("/login");
    }
  };

  return (
    <div className="app-frame">
      <header className="gradient-divider-bottom sticky top-0 z-40 border-b border-white/6 bg-[linear-gradient(180deg,rgba(8,11,25,0.96),rgba(8,11,25,0.76))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-4 px-4 py-3.5 lg:px-5">
          <Link href="/home" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#8b5cf6,#4f46e5)] text-white shadow-[0_0_28px_rgba(139,92,246,0.4)]">
              <FiHeart className="text-base" />
            </div>
            <div>
              <p className="text-[1.35rem] font-semibold leading-none text-white">조각</p>
              <p className="text-xs text-zinc-400">신뢰 기반 실시간 만남 앱</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {typeof trust === "number" && (
              <div className="badge-accent hidden items-center gap-2 px-4 py-2 text-sm sm:flex">
                <FiHeart className="text-sm" />
                신뢰 {trust}
              </div>
            )}
            <Link
              href="/chats"
              aria-label="알림"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/5 text-zinc-200 transition hover:bg-white/10 hover:text-white"
            >
              <FiBell className="text-base" />
            </Link>
            <Link
              href="/profile"
              aria-label="메뉴"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/8 bg-white/5 text-zinc-200 transition hover:bg-white/10 hover:text-white"
            >
              <FiMenu className="text-base" />
            </Link>
            <button type="button" onClick={handleLogout} className="btn-ghost hidden md:inline-flex">
              <span className="flex items-center gap-2">
                <FiLogOut />
                로그아웃
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto min-h-[calc(100vh-148px)] max-w-[1240px] px-4 py-5 lg:px-5">{children}</main>

      <nav className="gradient-divider-top sticky bottom-0 z-40 border-t border-white/6 bg-[linear-gradient(180deg,rgba(8,11,25,0.76),rgba(8,11,25,0.98))] backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1240px] items-center justify-around gap-2 px-2 py-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[1.25rem] px-2 py-2.5 text-xs font-medium transition ${
                  isActive
                    ? "bg-[linear-gradient(135deg,rgba(139,92,246,0.94),rgba(79,70,229,0.9))] text-on-accent shadow-[0_0_28px_rgba(139,92,246,0.28)]"
                    : "text-zinc-400 hover:bg-white/5 hover:text-violet-200"
                }`}
              >
                <Icon className="text-[1.1rem]" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
