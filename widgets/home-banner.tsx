"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

import TrustCrystalIcon from "@/shared/ui/trust-crystal-icon";

const AUTO_PLAY_MS = 5000;
// 이만큼(px) 이상 끌면 다음/이전 장으로 넘긴다. 그보다 적으면 제자리로 돌아간다.
const DRAG_THRESHOLD = 60;
// 이만큼(px) 넘게 움직였으면 끌기로 보고, 손을 뗄 때 버튼·링크 클릭을 막는다.
const CLICK_GUARD = 6;

type Slide = {
  key: string;
  eyebrow: string;
  title: string;
  copy: string;
  cta: string;
  href: string;
  background: string;
  art: ReactNode;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

// 슬라이드 그림: 마스코트 이미지 + 기능별 일러스트(SVG)
function MascotArt() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute right-[6%] top-1/2 h-[62%] max-h-[230px] w-auto -translate-y-1/2 md:h-[78%]">
        <div className="relative aspect-square h-full overflow-hidden rounded-[28px] shadow-[0_24px_60px_rgba(124,92,255,0.45)] ring-1 ring-white/15">
          <Image src="/icons/icon-512.png" alt="조각 마스코트" fill sizes="240px" className="object-cover" draggable={false} priority />
        </div>
      </div>
    </div>
  );
}

function TrustArt() {
  return (
    <div className="relative flex h-full w-full items-center justify-end pr-[8%]">
      <div className="relative flex h-[150px] w-[150px] items-center justify-center md:h-[190px] md:w-[190px]">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(196,181,253,0.45),transparent_65%)]" />
        <svg aria-hidden viewBox="0 0 200 200" className="absolute inset-0 h-full w-full animate-[spin_24s_linear_infinite]">
          <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.18)" strokeDasharray="4 10" strokeWidth="2" />
        </svg>
        <TrustCrystalIcon className="relative h-24 w-auto drop-shadow-[0_0_24px_rgba(167,139,250,0.9)] md:h-32" />
        <span className="absolute -right-1 top-3 rounded-full bg-emerald-400 px-3 py-1 text-[0.85rem] font-bold text-emerald-950 shadow-lg md:text-[0.95rem]">
          +1
        </span>
      </div>
    </div>
  );
}

function LocationArt() {
  return (
    <svg aria-hidden viewBox="0 0 320 220" className="h-full w-full" preserveAspectRatio="xMaxYMid meet">
      {/* 지도 격자 */}
      <g stroke="rgba(255,255,255,0.08)" strokeWidth="1">
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`v${i}`} x1={60 + i * 32} y1="10" x2={60 + i * 32} y2="210" />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`h${i}`} x1="60" y1={14 + i * 32} x2="316" y2={14 + i * 32} />
        ))}
      </g>
      <path d="M70 170 C 130 160, 150 90, 200 100 S 270 60, 300 40" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeDasharray="6 8" />
      {/* 나 */}
      <g transform="translate(110 150)">
        <circle r="26" fill="rgba(56,189,248,0.18)" className="animate-ping" style={{ transformOrigin: "center", animationDuration: "2.4s" }} />
        <circle r="11" fill="#38bdf8" stroke="#fff" strokeWidth="3" />
      </g>
      {/* 상대 */}
      <g transform="translate(262 70)">
        <path d="M0 -38 C 18 -38 26 -24 26 -14 C 26 4 0 22 0 22 C 0 22 -26 4 -26 -14 C -26 -24 -18 -38 0 -38 Z" fill="#a78bfa" stroke="#fff" strokeWidth="3" />
        <circle cy="-15" r="8" fill="#fff" />
      </g>
      <g transform="translate(186 112)">
        <rect x="-34" y="-14" width="68" height="28" rx="14" fill="rgba(15,12,40,0.85)" stroke="rgba(255,255,255,0.2)" />
        <text textAnchor="middle" y="5" fill="#e9d5ff" fontSize="13" fontWeight="600">
          350m
        </text>
      </g>
    </svg>
  );
}

function ReviewArt() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute right-[8%] top-[16%] w-[62%] max-w-[260px] rotate-[-4deg] rounded-[18px] bg-white/95 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
        <div className="flex gap-0.5 text-[1rem] text-amber-400">★★★★★</div>
        <p className="mt-1 text-[0.8rem] font-medium text-zinc-800 md:text-[0.88rem]">덕분에 즐거운 시간이었어요!</p>
      </div>
      <div className="absolute bottom-[14%] right-[20%] w-[54%] max-w-[220px] rotate-[3deg] rounded-[18px] bg-violet-200/95 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full bg-violet-600/15 px-2 py-0.5 text-[0.7rem] font-semibold text-violet-800">매너가 좋아요</span>
          <span className="rounded-full bg-violet-600/15 px-2 py-0.5 text-[0.7rem] font-semibold text-violet-800">시간 약속 굿</span>
        </div>
      </div>
    </div>
  );
}

const slides: Slide[] = [
  {
    key: "intro",
    eyebrow: "신뢰 기반 실시간 만남",
    title: "나와 꼭 맞는 조각을\n지금 찾아보세요",
    copy: "제목 한 줄과 태그로 올리고, 마음이 맞으면 바로 대화해요.",
    cta: "매칭 둘러보기",
    href: "/matching",
    background:
      "bg-[radial-gradient(circle_at_85%_30%,rgba(236,72,153,0.35),transparent_40%),radial-gradient(circle_at_15%_90%,rgba(56,189,248,0.18),transparent_40%),linear-gradient(135deg,#2b1a6b,#14102f_55%,#0b0f22)]",
    art: <MascotArt />,
  },
  {
    key: "trust",
    eyebrow: "만나면 신뢰 점수 +1",
    title: "약속을 지킬수록\n신뢰가 쌓여요",
    copy: "모두가 ‘만났어요’를 누르면 신뢰 점수가 올라가요.",
    cta: "내 신뢰 점수 보기",
    href: "/profile",
    background:
      "bg-[radial-gradient(circle_at_80%_50%,rgba(167,139,250,0.4),transparent_45%),linear-gradient(135deg,#1d1b5e,#0f1235_60%,#0a0d22)]",
    art: <TrustArt />,
  },
  {
    key: "location",
    eyebrow: "매칭되면 24시간",
    title: "약속 장소까지\n서로의 위치를 실시간으로",
    copy: "택시 호출처럼 상대가 어디쯤 왔는지 확인하고 만나요.",
    cta: "대화방 가기",
    href: "/chats",
    background:
      "bg-[radial-gradient(circle_at_75%_40%,rgba(56,189,248,0.28),transparent_45%),linear-gradient(135deg,#0d2a4a,#0c1430_60%,#080b1d)]",
    art: <LocationArt />,
  },
  {
    key: "review",
    eyebrow: "만남 후기",
    title: "솔직한 후기로\n더 믿을 수 있는 만남",
    copy: "만난 뒤 별점과 한줄후기를 남기면 게시판에 올라가요.",
    cta: "후기 보러 가기",
    href: "/notices?category=후기",
    background:
      "bg-[radial-gradient(circle_at_80%_30%,rgba(251,191,36,0.22),transparent_42%),linear-gradient(135deg,#3a1d5c,#1a1236_60%,#0c0b1f)]",
    art: <ReviewArt />,
  },
];

function SlideView({ slide, active, position, total }: { slide: Slide; active: boolean; position: number; total: number }) {
  return (
    <div
      role="group"
      aria-roledescription="slide"
      aria-label={`${position} / ${total}`}
      aria-hidden={!active}
      className="relative h-full w-full shrink-0 overflow-hidden"
    >
      <div
        className={cx(
          "absolute inset-0 transition-transform duration-[6000ms] ease-out",
          slide.background,
          active ? "scale-105" : "scale-100",
        )}
      />
      <div className="absolute inset-y-0 right-0 w-[52%] md:w-[48%]">{slide.art}</div>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,9,20,0.75),rgba(7,9,20,0.35)_55%,transparent)] md:bg-[linear-gradient(90deg,rgba(7,9,20,0.6),transparent_60%)]" />

      <div
        className={cx(
          "relative z-10 flex h-full max-w-[64%] flex-col justify-center px-5 transition-all delay-200 duration-700 md:max-w-[56%] md:px-8",
          active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <p className="text-[0.78rem] font-semibold text-violet-200 md:text-[0.88rem]">{slide.eyebrow}</p>
        <h3 className="mt-2 whitespace-pre-line break-keep text-[1.35rem] font-semibold leading-tight tracking-[-0.03em] text-white md:text-[2rem]">
          {slide.title}
        </h3>
        <p className="mt-2.5 hidden break-keep text-[0.9rem] text-zinc-200 sm:block">{slide.copy}</p>
        <Link
          href={slide.href}
          tabIndex={active ? 0 : -1}
          draggable={false}
          className="mt-4 inline-flex w-fit items-center gap-1 rounded-full bg-white/14 px-4 py-2 text-[0.82rem] font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/22 md:text-[0.88rem]"
        >
          {slide.cta}
          <FiChevronRight />
        </Link>
      </div>
    </div>
  );
}

// 홈 상단 배너: 5초마다 옆으로 부드럽게 넘어간다(끝에서 처음으로 자연스럽게 이어짐).
// PC는 마우스로 끌거나 좌우 화살표로, 모바일은 손가락으로 밀어서 넘긴다. 마우스를 올리거나 끄는 동안은 멈춘다.
export default function HomeBanner() {
  const total = slides.length;
  // 트랙: [마지막 장 복제, 1..N, 첫 장 복제] — 끝에서 다음으로 넘길 때도 같은 방향으로 이어지게 한다
  const track = [slides[total - 1], ...slides, slides[0]];
  const [position, setPosition] = useState(1);
  const [animate, setAnimate] = useState(true);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const dragMoved = useRef(false);

  const current = (position - 1 + total) % total;

  const go = useCallback((next: number) => {
    setAnimate(true);
    setPosition(next);
  }, []);

  // 복제 장에 도착하면 애니메이션 없이 진짜 장으로 바꿔 끼운다
  const handleTransitionEnd = () => {
    if (position === 0) {
      setAnimate(false);
      setPosition(total);
    } else if (position === total + 1) {
      setAnimate(false);
      setPosition(1);
    }
  };

  useEffect(() => {
    if (hovered || dragging) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") go(position + 1);
    }, AUTO_PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [position, hovered, dragging, go]);

  // 바꿔 끼운 다음 프레임부터 다시 애니메이션을 켠다
  useEffect(() => {
    if (animate) return;
    const frame = window.requestAnimationFrame(() => setAnimate(true));
    return () => window.cancelAnimationFrame(frame);
  }, [animate]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // 복제 장에서 멈춰 있으면 먼저 진짜 장으로 맞춘다
    if (position === 0 || position === total + 1) handleTransitionEnd();
    dragStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    dragMoved.current = false;
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // 손가락이 세로로 더 많이 움직이면 페이지 스크롤로 보고 끌기를 그만둔다
    if (!dragMoved.current && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > CLICK_GUARD) {
      dragStart.current = null;
      setDragging(false);
      setDragX(0);
      return;
    }
    if (Math.abs(dx) > CLICK_GUARD && !dragMoved.current) {
      dragMoved.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (dragMoved.current) setDragX(dx);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start || start.id !== event.pointerId) return;
    dragStart.current = null;
    const dx = event.clientX - start.x;
    const width = viewportRef.current?.offsetWidth ?? 1;
    setDragging(false);
    setDragX(0);
    if (dragMoved.current && Math.abs(dx) > Math.min(DRAG_THRESHOLD, width * 0.2)) {
      go(position + (dx < 0 ? 1 : -1));
    } else {
      setAnimate(true);
    }
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="조각 소개"
      className="keep-dark group relative overflow-hidden rounded-[22px] border border-white/7 shadow-[0_18px_36px_rgba(0,0,0,0.26)]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <div
        ref={viewportRef}
        className={cx(
          "relative h-[230px] touch-pan-y select-none overflow-hidden md:h-[280px]",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        // 끌어서 넘긴 경우에는 손을 뗄 때 링크가 눌리지 않게 막는다
        onClickCapture={(event) => {
          if (dragMoved.current) {
            event.preventDefault();
            event.stopPropagation();
            dragMoved.current = false;
          }
        }}
        onDragStart={(event) => event.preventDefault()}
      >
        <div
          className={cx(
            "flex h-full",
            animate && !dragging && "transition-transform duration-700 ease-[cubic-bezier(0.22,0.61,0.36,1)]",
          )}
          style={{ transform: `translate3d(calc(${-position * 100}% + ${dragX}px), 0, 0)` }}
          onTransitionEnd={(event) => {
            if (event.target === event.currentTarget) handleTransitionEnd();
          }}
        >
          {track.map((slide, trackIndex) => (
            <SlideView
              key={`${slide.key}-${trackIndex}`}
              slide={slide}
              active={trackIndex === position}
              position={((trackIndex - 1 + total) % total) + 1}
              total={total}
            />
          ))}
        </div>
      </div>

      {/* 배너 화살표: PC에서 마우스를 올리면 나타난다 */}
      <button
        type="button"
        onClick={() => go(position - 1)}
        aria-label="이전 배너"
        className="absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 ring-1 ring-white/15 backdrop-blur transition hover:bg-black/55 focus-visible:opacity-100 group-hover:opacity-100 md:flex"
      >
        <FiChevronLeft className="text-[1.2rem]" />
      </button>
      <button
        type="button"
        onClick={() => go(position + 1)}
        aria-label="다음 배너"
        className="absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 ring-1 ring-white/15 backdrop-blur transition hover:bg-black/55 focus-visible:opacity-100 group-hover:opacity-100 md:flex"
      >
        <FiChevronRight className="text-[1.2rem]" />
      </button>

      {/* 진행 표시: 현재 장은 길게, 누르면 그 장으로 */}
      <div className="absolute bottom-3.5 left-5 z-20 flex items-center gap-1.5 md:left-8">
        {slides.map((slide, slideIndex) => (
          <button
            key={slide.key}
            type="button"
            onClick={() => go(slideIndex + 1)}
            aria-label={`${slideIndex + 1}번째 배너`}
            aria-current={slideIndex === current}
            className={cx(
              "h-1.5 rounded-full transition-all duration-500",
              slideIndex === current ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70",
            )}
          />
        ))}
      </div>
      <span className="absolute bottom-3 right-4 z-20 rounded-full bg-black/35 px-2.5 py-0.5 text-[0.72rem] text-white/85 md:right-5">
        {current + 1} / {total}
      </span>
    </section>
  );
}
