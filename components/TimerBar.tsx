"use client";
import { motion } from "motion/react";
import { DISPLAY_FONT, THEME } from "@/lib/theme";
import { TimerIcon } from "@/components/icons";

export function TimerBar({ left, total = 60 }: { left: number | null; total?: number }) {
  if (left === null) return null;
  const pct = Math.max(0, Math.min(1, left / total));
  const urgent = left <= 10;
  return (
    <div style={{ marginTop: 8, maxWidth: 520 }} role="timer" aria-label={`${left} seconds left`} aria-live="off">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: DISPLAY_FONT,
          fontSize: 30,
          color: urgent ? THEME.error : "#fff",
        }}
      >
        <TimerIcon size={30} /> {left}s
      </div>
      <div style={{ height: 14, borderRadius: 999, border: "3px solid #111", background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
        <motion.div
          // GPU-friendly: scaleX on a full-width child, never layout width.
          animate={{ scaleX: pct }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          style={{ height: "100%", width: "100%", transformOrigin: "left", background: urgent ? THEME.error : THEME.teal }}
        />
      </div>
    </div>
  );
}
