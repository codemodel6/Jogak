"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { FiAlertTriangle, FiChevronRight, FiFileText, FiHeart, FiHome, FiMessageCircle, FiUser } from "react-icons/fi";

import { useMyPendingPenaltiesQuery } from "@/entities/match/hooks";
import { useProfileQuery } from "@/entities/profile/hooks";
import { useDailyCheckIn } from "@/entities/wallet/hooks";
import NotificationBell from "@/features/notification/notification-bell";
import { useOnlineUsers } from "@/shared/lib/presence/online-users";
import { syncPushSubscription } from "@/shared/lib/push/push";
import ThemeToggle from "@/shared/ui/theme-toggle";

export type MainNavKey = "home" | "matching" | "chats" | "notices" | "profile";

// PC에서는 왼쪽 사이드바, 모바일에서는 하단 탭으로 보이는 같은 메뉴
const navItems: Array<{ key: MainNavKey; label: string; icon: typeof FiHome; href: string }> = [
  { key: "home", label: "홈", icon: FiHome, href: "/home" },
  { key: "matching", label: "매칭", icon: FiHeart, href: "/matching" },
  { key: "chats", label: "채팅", icon: FiMessageCircle, href: "/chats" },
  { key: "notices", label: "게시판", icon: FiFileText, href: "/notices" },
  { key: "profile", label: "내 정보", icon: FiUser, href: "/profile" },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

type MainLayoutProps = {
  active: MainNavKey;
  title: string;
  copy?: string;
  // 모바일 상단에 제목 대신 보여줄 문구 (홈은 서비스 이름)
  mobileTitle?: string;
  headerActions?: ReactNode;
  // 본문 최대 폭. 채팅처럼 넓게 쓰는 화면은 크게 준다.
  maxWidthClassName?: string;
  // 화면 높이를 꽉 채우고 내부에서 스크롤하는 화면(채팅)
  fullHeight?: boolean;
  // 모바일에서 하단 탭을 숨길 화면(채팅 대화창)
  hideMobileNav?: boolean;
  hideMobileHeader?: boolean;
  children: ReactNode;
};

export default function MainLayout({
  active,
  title,
  copy,
  mobileTitle,
  headerActions,
  maxWidthClassName = "max-w-[1040px]",
  fullHeight = false,
  hideMobileNav = false,
  hideMobileHeader = false,
  children,
}: MainLayoutProps) {
  const { data } = useProfileQuery();
  const profile = data?.profile;
  const profileName = profile?.name?.trim() || "";
  const profilePhoto = profile?.photos?.[0];
  // 로그인한 사람이 어느 메인 화면에 있든 "접속 중"으로 잡힌다
  useOnlineUsers(profile?.userId);
  // 상대가 "못 만났어요"를 누르면 1시간 안에 조치해야 하므로 어느 화면에서든 알린다
  const penaltiesQuery = useMyPendingPenaltiesQuery(profile?.userId, true);
  const pendingPenalty = penaltiesQuery.data?.penalties[0];
  // 하루 한 번 출석 체크 (7일 연속마다 보너스 매칭권)
  useDailyCheckIn(profile?.userId);

  // 알림을 허용한 기기는 들어올 때마다 구독을 다시 저장한다 (계정 전환·구독 만료 대비)
  useEffect(() => {
    if (profile?.userId) void syncPushSubscription().catch(() => undefined);
  }, [profile?.userId]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--app-glow),transparent_22%),radial-gradient(circle_at_top_right,var(--app-glow-2),transparent_18%),linear-gradient(180deg,var(--app-bg),var(--app-bg-end))] text-white xl:grid xl:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="xl:sticky xl:top-0 xl:h-screen xl:border-r xl:border-white/7 xl:bg-[var(--sidebar)] xl:px-4 xl:py-5">
        <Link href="/home" className="desktop-brand hidden xl:flex">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-[14px] object-cover"
          />
          <p className="desktop-brand-text">조각</p>
        </Link>

        <nav
          className={cx(
            "fixed inset-x-0 bottom-0 z-[90] grid grid-cols-5 gap-1 border-t border-white/8 bg-nav px-3 py-1.5 backdrop-blur-xl",
            "xl:static xl:z-auto xl:mt-7 xl:block xl:space-y-2 xl:border-0 xl:bg-none xl:p-0 xl:backdrop-blur-none",
            hideMobileNav && "hidden",
          )}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === active;

            return (
              <Link
                key={item.key}
                href={item.href}
                className={cx(
                  "flex flex-col items-center justify-center gap-1 rounded-[16px] py-1 font-medium transition",
                  "xl:flex-row xl:justify-start xl:gap-4 xl:px-4 xl:py-3",
                  isActive
                    ? "text-[#7b5cff] xl:bg-[linear-gradient(135deg,#6f56ff,#7b50f3)] xl:text-on-accent xl:shadow-[0_16px_28px_rgba(66,41,160,0.24)]"
                    : "text-zinc-400 xl:text-zinc-300 xl:hover:bg-white/4 xl:hover:text-white",
                )}
              >
                <Icon className="text-[1.18rem] xl:text-[1.35rem]" />
                <span className="home-tab-text xl:text-[1rem]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div
        className={cx(
          "min-w-0 px-4 pt-4 md:px-6 xl:px-8 xl:pt-5",
          fullHeight ? "flex h-dvh flex-col pb-20 xl:pb-5" : "pb-28 xl:pb-10",
          fullHeight && hideMobileNav && "pb-4",
        )}
      >
        <header
          className={cx(
            "mx-auto flex w-full shrink-0 items-center justify-between gap-4 border-b border-white/6 pb-4",
            maxWidthClassName,
            hideMobileHeader && "hidden xl:flex",
          )}
        >
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex items-center gap-2.5 xl:hidden">
              <Image
                src="/icons/icon-192.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-[12px] object-cover"
              />
              <h1 className="text-[1.6rem] font-semibold leading-none tracking-[-0.04em] text-white">
                {mobileTitle ?? title}
              </h1>
            </div>
            <h1 className="desktop-header-title hidden shrink-0 xl:block">{title}</h1>
            {copy && <p className="desktop-header-copy hidden truncate xl:block">{copy}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-4 xl:gap-5">
            {headerActions}
            <ThemeToggle className="-mx-1.5" />
            <NotificationBell userId={profile?.userId} />
            <Link href="/profile" className="flex items-center gap-3">
              <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-[linear-gradient(135deg,var(--avatar-from),var(--avatar-to))] xl:h-11 xl:w-11">
                {profilePhoto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" src={profilePhoto} className="h-full w-full object-cover" />
                )}
              </div>
              {profileName && (
                <span className="hidden text-[1.1rem] font-medium text-white md:inline">{profileName}</span>
              )}
            </Link>
          </div>
        </header>

        <div className={cx("mx-auto w-full", maxWidthClassName, fullHeight && "flex min-h-0 flex-1 flex-col")}>
          {pendingPenalty && (
            <Link
              href={`/chat/${pendingPenalty.chatId}`}
              className="mt-3 flex shrink-0 items-center gap-2.5 rounded-[14px] border border-rose-400/30 bg-rose-500/12 px-4 py-2.5 text-[0.85rem] text-rose-100 transition hover:bg-rose-500/18"
            >
              <FiAlertTriangle className="shrink-0 text-rose-300" />
              <span className="min-w-0 flex-1 break-keep">
                {pendingPenalty.reporterName}님이 &lsquo;못 만났어요&rsquo;를 눌렀어요. 1시간 안에 조치하지 않으면 신뢰 점수가 1점 깎여요.
              </span>
              <span className="flex shrink-0 items-center font-semibold text-white">
                확인
                <FiChevronRight />
              </span>
            </Link>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
