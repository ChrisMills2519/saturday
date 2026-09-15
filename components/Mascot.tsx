"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { IMAGES } from "@/lib/theme";

// Animated mascot cutout. Static user PNGs (transparent, 1000x1000)
// get all life from transforms: entrance slam, idle bob/squash,
// phase-speed. Missing file -> renders nothing (caller shows walker
// fallback), never a broken-image icon.
export function Mascot({
  src,
  alt,
  size = 220,
  bounce = 1,
  spin = 0,
}: {
  src: string;
  alt: string;
  size?: number;
  bounce?: number;
  spin?: number;
}) {
  const [gone, setGone] = useState(false);
  const reduce = useReducedMotion();
  if (gone) return null;
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { scale: 1.4, rotate: -4 + spin, opacity: 0 }}
      animate={{ scale: 1, rotate: spin, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <motion.img
        src={src}
        alt={alt}
        width={size}
        height={size}
        onError={() => setGone(true)}
        animate={reduce ? {} : { y: [0, -12 * bounce, 0], scaleY: [1, 0.96, 1] }}
        transition={{ duration: 2.2 / Math.max(bounce, 0.5), repeat: Infinity, ease: "easeInOut" }}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
      />
    </motion.div>
  );
}

// Full-bleed user backdrop. bg-burst.png over the CSS gradient;
// drifts slowly for parallax. Missing file -> CSS gradient only.
export function StageBg({ children }: { children: React.ReactNode }) {
  const [bgGone, setBgGone] = useState(false);
  const reduce = useReducedMotion();
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {!bgGone && (
        <motion.img
          src={IMAGES.bg}
          alt=""
          aria-hidden="true"
          onError={() => setBgGone(true)}
          initial={false}
          animate={reduce ? {} : { x: ["0%", "-2%", "0%"] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          style={{
            position: "absolute",
            inset: "-2%",
            width: "104%",
            height: "104%",
            objectFit: "cover",
            opacity: 0.55,
            pointerEvents: "none",
          }}
        />
      )}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}
