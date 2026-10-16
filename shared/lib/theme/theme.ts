"use client";

import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY as STORAGE_KEY } from "./init-script";

export type Theme = "dark" | "light";

const listeners = new Set<() => void>();

function readTheme(): Theme {
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setTheme(theme: Theme) {
  const classList = document.documentElement.classList;
  classList.remove("light", "dark");
  classList.add(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장이 막힌 브라우저에서는 이번 방문 동안만 유지된다
  }
  listeners.forEach((listener) => listener());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "dark" as Theme);
  return { theme, toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark") };
}
