"use client";
import { useMemo } from "react";
import {
  HumanoidWalker,
  PHASE_TO_MOOD,
  type AvatarSpec,
  type Phase,
} from "@/app/preview/HumanoidWalker";

// Player-driven avatar parade. Same walker rig as /preview, but the cast
// is the real room roster — names, deterministic shirt colors, staggered
// lanes — instead of the 4 hardcoded demo AVATARS. Mood follows the phase
// (idle LOBBY → march SCORE), so the TV feels alive without server ticks.
const SHIRTS = ["#f472b6", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa", "#fb7185", "#22d3ee", "#f97316"];
const SKINS = ["#fcd7b0", "#e8b88a", "#8d5a3b", "#f0c8a0"];
const PANTS = ["#312e81", "#6b7280", "#7c2d12", "#0f766e"];

export function PlayerParade({
  phase,
  players,
  disabled,
  height = 220,
}: {
  phase: Phase;
  players: { session_id: string; name: string }[];
  disabled: boolean;
  height?: number;
}) {
  const mood = PHASE_TO_MOOD[phase];
  const specs = useMemo<AvatarSpec[]>(
    () =>
      players.slice(0, 8).map((p, i) => ({
        name: p.name,
        skin: SKINS[i % SKINS.length],
        shirt: SHIRTS[i % SHIRTS.length],
        pants: PANTS[i % PANTS.length],
        top: `${(i % 4) * 22}%`,
        scale: 0.8 + ((i * 7) % 4) * 0.12,
        duration: 12 + ((i * 5) % 9),
        delay: (i * 1.7) % 6,
        flip: i % 2 === 1,
      })),
    [players]
  );
  if (disabled || players.length === 0) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        height,
        overflow: "hidden",
        borderRadius: 14,
        background: "linear-gradient(180deg,#0f172a,#1e1b4b)",
        border: "1px solid rgba(255,255,255,0.1)",
        marginTop: 12,
      }}
    >
      {specs.map((s, i) => (
        <HumanoidWalker key={`${s.name}-${i}`} spec={s} mood={mood} />
      ))}
    </div>
  );
}
