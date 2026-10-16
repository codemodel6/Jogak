"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  FiChevronLeft,
  FiChevronRight,
  FiFileText,
  FiHeadphones,
  FiLock,
  FiLogOut,
  FiShield,
  FiUser,
  FiUserX,
} from "react-icons/fi";
import { PiDiamondLight } from "react-icons/pi";

import { useNotificationSettingsQuery, useSaveNotificationSettingsMutation } from "@/entities/notification/hooks";
import { useAuthStatusQuery, useSignOutMutation } from "@/features/auth/hooks";
import PushToggle from "@/features/notification/push-toggle";
import MainLayout from "@/widgets/main-layout";

type MenuItem = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  href?: string;
};

const menuGroups: Array<{ title: string; items: MenuItem[] }> = [
  {
    title: "계정",
    items: [
      { icon: FiUser, label: "계정 설정" },
      { icon: PiDiamondLight, label: "포인트 내역", href: "/points" },
      { icon: FiLock, label: "차단 관리" },
    ],
  },
  {
    title: "고객지원",
    items: [
      { icon: FiFileText, label: "게시판", href: "/notices" },
      { icon: FiHeadphones, label: "고객센터" },
      { icon: FiShield, label: "이용약관 · 개인정보처리방침" },
    ],
  },
];

const notificationOptions = [
  { key: "match", label: "매칭 알림", description: "매칭 요청·수락, 만남 확인, 감점, 후기 소식" },
  { key: "chat", label: "채팅 알림", description: "새 메시지, 새 대화 요청" },
  { key: "event", label: "활동·이벤트 알림", description: "내 글의 새 댓글, 이벤트 소식" },
] as const;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function SettingsPage() {
  const router = useRouter();
  const { data: isAuthenticated } = useAuthStatusQuery();
  const signOutMutation = useSignOutMutation();
  // 끄면 그 종류는 알림창으로 보내지 않는다 (알림 목록에는 그대로 남는다)
  const settingsQuery = useNotificationSettingsQuery(isAuthenticated === true);
  const saveSettings = useSaveNotificationSettingsMutation();
  const notifications = settingsQuery.data;
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated === false) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleLogout = async () => {
    try {
      await signOutMutation.mutateAsync();
    } finally {
      router.replace("/login");
    }
  };

  const showPreparing = () => setNotice("이 메뉴는 아직 준비 중입니다.");

  return (
    <MainLayout active="profile" title="설정" copy="알림과 계정을 관리하세요." maxWidthClassName="max-w-[760px]">
      <Link
        href="/profile"
        className="mt-4 inline-flex items-center gap-1.5 text-[0.88rem] text-zinc-300 transition hover:text-white"
      >
        <FiChevronLeft />
        내 정보로
      </Link>

      <div className="mt-3 flex flex-col gap-4">
        <section className="desktop-panel px-5 py-4">
          <h2 className="text-[0.88rem] font-medium text-zinc-400">알림</h2>
          <div className="mt-2 divide-y divide-white/7">
            <PushToggle />
            {notificationOptions.map((option) => {
              const enabled = notifications?.[option.key] ?? true;

              return (
                <label key={option.key} className="flex cursor-pointer items-center justify-between gap-4 py-3.5">
                  <span>
                    <span className="block text-[0.95rem] text-zinc-100">{option.label}</span>
                    <span className="mt-0.5 block text-[0.8rem] text-zinc-500">{option.description}</span>
                  </span>
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={enabled}
                    disabled={!notifications}
                    onChange={(event) => {
                      if (!notifications) return;
                      saveSettings.mutate(
                        { ...notifications, [option.key]: event.target.checked },
                        { onError: () => setNotice("알림 설정을 저장하지 못했어요.") },
                      );
                    }}
                  />
                  <span className="relative h-6 w-11 shrink-0 rounded-full bg-white/12 transition after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-[#fff] after:shadow-sm after:transition peer-checked:bg-violet-500 peer-checked:after:translate-x-5" />
                </label>
              );
            })}
          </div>
        </section>

        {menuGroups.map((group) => (
          <section key={group.title} className="desktop-panel px-5 py-4">
            <h2 className="text-[0.88rem] font-medium text-zinc-400">{group.title}</h2>
            <div className="mt-2 divide-y divide-white/7">
              {group.items.map((item) => {
                const Icon = item.icon;
                const content = (
                  <>
                    <span className="flex items-center gap-4">
                      <Icon className="text-[1.1rem] text-violet-300" />
                      <span className="text-[0.95rem] text-zinc-100">{item.label}</span>
                    </span>
                    <FiChevronRight className="text-zinc-500" />
                  </>
                );
                const className = "flex w-full items-center justify-between gap-4 py-3.5 text-left transition hover:text-violet-200";

                return item.href ? (
                  <Link key={item.label} href={item.href} className={className}>
                    {content}
                  </Link>
                ) : (
                  <button key={item.label} type="button" onClick={showPreparing} className={className}>
                    {content}
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <section className="desktop-panel px-5 py-2">
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={signOutMutation.isPending}
            className="flex w-full items-center gap-4 py-3.5 text-left text-[0.95rem] text-zinc-100 transition hover:text-violet-200 disabled:opacity-60"
          >
            <FiLogOut className="text-[1.1rem] text-violet-300" />
            {signOutMutation.isPending ? "로그아웃 중..." : "로그아웃"}
          </button>
          <button
            type="button"
            onClick={showPreparing}
            className={cx(
              "flex w-full items-center gap-4 border-t border-white/7 py-3.5 text-left text-[0.95rem] text-rose-300 transition hover:text-rose-200",
            )}
          >
            <FiUserX className="text-[1.1rem]" />
            회원 탈퇴
          </button>
        </section>
      </div>

      {notice && (
        <div className="fixed left-1/2 top-4 z-[130] -translate-x-1/2 rounded-2xl border border-violet-400/20 bg-surface/95 px-4 py-3 text-sm text-violet-100 shadow-xl">
          {notice}
        </div>
      )}
    </MainLayout>
  );
}
