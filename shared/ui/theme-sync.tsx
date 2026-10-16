"use client";

import { useEffect } from "react";

import { themeInitScript } from "@/shared/lib/theme/init-script";

// 하이드레이션이 실패해 React가 <html>을 다시 그리면 다크/라이트 클래스가 지워진다.
// 화면이 붙은 뒤 한 번 더 적용해 저장된 모드를 되살린다.
export default function ThemeSync() {
  useEffect(() => {
    new Function(themeInitScript)();
  }, []);
  return null;
}
