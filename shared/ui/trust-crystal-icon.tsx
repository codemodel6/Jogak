import { useId } from "react";

// 신뢰 포인트 재화 아이콘: 세로로 길쭉한 결정(크리스털). 면마다 다른 그라데이션으로 입체감을 준다.
export default function TrustCrystalIcon({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");

  return (
    <svg viewBox="0 0 24 36" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-left`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5d0fe" />
          <stop offset="55%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#5b21b6" />
        </linearGradient>
        <linearGradient id={`${id}-right`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#3b0764" />
        </linearGradient>
        <linearGradient id={`${id}-center`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#e0e7ff" />
          <stop offset="100%" stopColor="#a5f3fc" />
        </linearGradient>
      </defs>

      {/* 바깥 면 */}
      <path d="M12 1 L4 11 L12 35 Z" fill={`url(#${id}-left)`} />
      <path d="M12 1 L20 11 L12 35 Z" fill={`url(#${id}-right)`} />
      {/* 가운데 빛 받는 면 */}
      <path d="M12 1 L8.6 11 L12 35 L15.4 11 Z" fill={`url(#${id}-center)`} opacity="0.85" />
      {/* 어깨 가로 결 */}
      <path d="M4 11 L8.6 11 L12 13.5 L15.4 11 L20 11" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="0.6" />
      {/* 위쪽 반짝임 */}
      <path d="M10.2 5.5 L12 2.8 L12.6 6.4 Z" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}
