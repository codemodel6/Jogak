"use client";

import { FiMoon, FiSun } from "react-icons/fi";

import { useTheme } from "@/shared/lib/theme/theme";

// 다크 ↔ 라이트 전환 버튼 (해: 지금 다크 → 누르면 라이트, 달: 반대)
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "라이트 모드로 바꾸기" : "다크 모드로 바꾸기"}
      title={isDark ? "라이트 모드" : "다크 모드"}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-zinc-300 transition hover:bg-white/8 hover:text-white ${className}`}
    >
      {isDark ? <FiSun className="text-[1.3rem]" /> : <FiMoon className="text-[1.25rem]" />}
    </button>
  );
}
