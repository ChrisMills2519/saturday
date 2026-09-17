"use client";
import { useMemo } from "react";
import { motion } from "motion/react";
import { THEME } from "@/lib/theme";

const CONFETTI_COLORS = ["#f472b6", "#a78bfa", THEME.success, "#fbbf24", THEME.blue];

export function Confetti({ burst }: { burst: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        id: i + burst * 1000,
        x: (i * 137) % 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: (i % 20) * 0.02,
        size: 6 + ((i * 7) % 8),
      })),
    [burst]
  );
  if (burst === 0) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, overflow: "hidden" }}>
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}vw`, y: "-5vh", rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", rotate: 720, opacity: [1, 1, 0] }}
          transition={{ duration: 2.4 + (p.id % 5) * 0.3, delay: p.delay, ease: "easeIn" }}
          style={{ position: "absolute", top: 0, borderRadius: 2, background: p.color, width: p.size, height: p.size * 0.6 }}
        />
      ))}
    </div>
  );
}
