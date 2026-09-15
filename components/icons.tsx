"use client";
import { motion } from "motion/react";

// Saturday icon set. Replaces emoji-as-iconography with a consistent
// stroke style: viewBox 24, stroke=currentColor, 2px, round caps.
// TV default 32px, phone default 24px. All animation happens on the
// wrapping motion element (scale/x/opacity only) — GPU-safe.
// Text labels always accompany icons; never icon-only buttons.

type P = { size?: number };

function Base({ size = 28, children }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, verticalAlign: "middle" }}
    >
      {children}
    </svg>
  );
}

export function TimerIcon({ size = 28 }: P) {
  return (
    <Base size={size}>
      <circle cx={12} cy={13} r={8} />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M9 2h6" />
    </Base>
  );
}

export function MaskIcon({ size = 32 }: P) {
  return (
    <Base size={size}>
      <path d="M4 5h16v5a8 8 0 0 1-16 0V5z" />
      <circle cx={9} cy={11} r={0.5} fill="currentColor" />
      <circle cx={15} cy={11} r={0.5} fill="currentColor" />
      <path d="M8.5 15.5a4 4 0 0 0 7 0" />
    </Base>
  );
}

export function BallotIcon({ size = 32 }: P) {
  return (
    <Base size={size}>
      <path d="M4 10h16v10H4z" />
      <path d="M2 10l10-6 10 6" />
      <path d="M9 15l2 2 4-4" />
    </Base>
  );
}

export function TrophyIcon({ size = 32 }: P) {
  return (
    <Base size={size}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 5H4a3 3 0 0 0 3 5" />
      <path d="M16 5h4a3 3 0 0 1-3 5" />
      <path d="M12 13v4" />
      <path d="M8 21h8" />
      <path d="M10 17h4" />
    </Base>
  );
}

export function CheckIcon({ size = 24, animated = false }: P & { animated?: boolean }) {
  if (!animated) {
    return (
      <Base size={size}>
        <path d="M5 12l5 5 9-10" />
      </Base>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, verticalAlign: "middle" }}
    >
      <motion.path
        d="M5 12l5 5 9-10"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35 }}
      />
    </svg>
  );
}

export function EyeIcon({ size = 24 }: P) {
  return (
    <Base size={size}>
      <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
      <circle cx={12} cy={12} r={2.5} />
    </Base>
  );
}

export function DrawIcon({ size = 24 }: P) {
  return (
    <Base size={size}>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" />
      <path d="M14.5 6.5l3 3" />
    </Base>
  );
}

export function LockIcon({ size = 20 }: P) {
  return (
    <Base size={size}>
      <rect x={5} y={10} width={14} height={10} rx={2} />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Base>
  );
}

const MEDAL_COLORS = ["#fbbf24", "#e5e7eb", "#d97706"] as const;

export function MedalIcon({ rank = 1, size = 30 }: { rank: number; size?: number }) {
  if (rank > 3) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: size,
          height: size,
          borderRadius: 999,
          border: "2px solid rgba(255,255,255,0.35)",
          color: "#fff",
          fontSize: size * 0.5,
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {rank}
      </span>
    );
  }
  const color = MEDAL_COLORS[rank - 1];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0, verticalAlign: "middle" }}>
      <path d="M7 3l3 5 2-2 2 2 3-5" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={12} cy={15} r={6} fill={color} opacity={0.25} />
      <circle cx={12} cy={15} r={6} fill="none" stroke={color} strokeWidth={2} />
      <text x={12} y={18.5} textAnchor="middle" fontSize={9} fontWeight={800} fill={color}>
        {rank}
      </text>
    </svg>
  );
}
