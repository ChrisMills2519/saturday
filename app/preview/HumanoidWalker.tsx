"use client";
import { motion } from "motion/react";

export type Phase = "LOBBY" | "INPUT" | "REVEAL" | "VOTE" | "SCORE";
export type WalkerMood = "idle" | "pace" | "excited" | "shuffle" | "march";

export const PHASE_TO_MOOD: Record<Phase, WalkerMood> = {
  LOBBY: "idle",
  INPUT: "pace",
  REVEAL: "excited",
  VOTE: "shuffle",
  SCORE: "march",
};

type MoodConfig = {
  limbDuration: number;
  legSwing: number;
  armSwing: number;
  bob: number;
  hop: number;
  lean: number;
  armsUp: boolean;
  speedMult: number;
};

const MOODS: Record<WalkerMood, MoodConfig> = {
  idle: { limbDuration: 0.9, legSwing: 16, armSwing: 12, bob: 4, hop: 0, lean: 0, armsUp: false, speedMult: 1.5 },
  pace: { limbDuration: 0.55, legSwing: 30, armSwing: 24, bob: 9, hop: 0, lean: 5, armsUp: false, speedMult: 1 },
  excited: { limbDuration: 0.32, legSwing: 36, armSwing: 48, bob: 14, hop: -26, lean: -4, armsUp: true, speedMult: 0.7 },
  shuffle: { limbDuration: 0.38, legSwing: 15, armSwing: 10, bob: 3, hop: 0, lean: 9, armsUp: false, speedMult: 0.85 },
  march: { limbDuration: 0.48, legSwing: 42, armSwing: 32, bob: 7, hop: -8, lean: 0, armsUp: false, speedMult: 0.9 },
};

export type AvatarSpec = {
  name: string;
  skin: string;
  shirt: string;
  pants: string;
  top: string;
  scale: number;
  duration: number;
  delay: number;
  flip: boolean;
};

export const AVATARS: AvatarSpec[] = [
  { name: "MOM", skin: "#fcd7b0", shirt: "#f472b6", pants: "#312e81", top: "2%", scale: 1.15, duration: 16, delay: 0, flip: false },
  { name: "DAD", skin: "#e8b88a", shirt: "#60a5fa", pants: "#6b7280", top: "24%", scale: 1.35, duration: 21, delay: 3, flip: false, },
  { name: "ZOE", skin: "#8d5a3b", shirt: "#34d399", pants: "#7c2d12", top: "46%", scale: 0.95, duration: 12, delay: 1, flip: true },
  { name: "LEO", skin: "#f0c8a0", shirt: "#fbbf24", pants: "#0f766e", top: "64%", scale: 0.85, duration: 18, delay: 6, flip: true },
];

function Limb({
  color,
  width,
  height,
  swing,
  duration,
  delay = 0,
  rounded = 8,
  outline = false,
}: {
  color: string;
  width: number;
  height: number;
  swing: number;
  duration: number;
  delay?: number;
  rounded?: number;
  outline?: boolean;
}) {
  return (
    <motion.div
      animate={{ rotate: [swing, -swing] }}
      transition={{ duration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay }}
      style={{
        width,
        height,
        background: color,
        borderRadius: rounded,
        transformOrigin: "top center",
        border: outline ? "1px solid rgba(255,255,255,0.25)" : undefined,
      }}
    />
  );
}

export function HumanoidWalker({ spec, mood }: { spec: AvatarSpec; mood: WalkerMood }) {
  const m = MOODS[mood];
  const s = spec.scale;
  const travel = m.speedMult * spec.duration;
  // Full mirror cycle is 2*duration, so opposite-phase limbs need delay = duration (180°)
  const half = m.limbDuration;

  return (
    <div
      style={{
        position: "absolute",
        top: spec.top,
        left: 0,
        transform: spec.flip ? "scaleX(-1)" : "none",
      }}
    >
      <motion.div
        initial={{ x: "-12vw" }}
        animate={{ x: "112vw" }}
        transition={{ duration: travel, repeat: Infinity, delay: spec.delay, ease: "linear" }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        {/* scale wrapper (static) so motion transform below is never clobbered */}
        <div style={{ transform: `scale(${s})` }}>
        {/* bob + hop layer */}
        <motion.div
          animate={{ y: [0, -m.bob, m.hop, 0], rotate: m.lean }}
          transition={{ duration: m.limbDuration, repeat: Infinity, ease: "easeInOut" }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
        >
          {/* head */}
          <div style={{ position: "relative", width: 34, height: 34, borderRadius: 999, background: spec.skin, border: "2px solid rgba(0,0,0,0.35)" }}>
            {/* hair cap */}
            <div style={{ position: "absolute", top: -4, left: 2, right: 2, height: 12, borderRadius: "10px 10px 4px 4px", background: "rgba(0,0,0,0.55)" }} />
            <div style={{ position: "absolute", top: 13, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
              <div style={{ width: 5, height: 6, borderRadius: 999, background: "#111" }} />
              <div style={{ width: 5, height: 6, borderRadius: 999, background: "#111" }} />
            </div>
            <div
              style={{
                position: "absolute",
                bottom: 5,
                left: "50%",
                width: mood === "excited" ? 12 : 9,
                height: mood === "excited" ? 8 : 5,
                borderRadius: "0 0 10px 10px",
                background: mood === "excited" ? "#7f1d1d" : "transparent",
                borderBottom: "2px solid #111",
                transform: "translateX(-50%)",
              }}
            />
          </div>

          {/* torso + arms */}
          <div style={{ position: "relative", display: "flex", justifyContent: "center", marginTop: 2 }}>
            {/* left arm (opposite left leg) */}
            <div style={{ position: "absolute", left: -14, top: 2, transform: m.armsUp ? "rotate(-150deg)" : "none", transformOrigin: "top center" }}>
              {m.armsUp ? (
                <motion.div
                  animate={{ rotate: [-18, 18] }}
                  transition={{ duration: m.limbDuration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: half }}
                  style={{ width: 9, height: 30, background: spec.skin, borderRadius: 8, transformOrigin: "top center", border: "1px solid rgba(0,0,0,0.3)" }}
                />
              ) : (
                <Limb color={spec.skin} width={9} height={30} swing={m.armSwing} duration={m.limbDuration} delay={half} />
              )}
            </div>
            {/* torso */}
            <div
              style={{
                width: 34,
                height: 38,
                borderRadius: 10,
                background: spec.shirt,
                border: "2px solid rgba(0,0,0,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                fontWeight: 800,
                color: "rgba(0,0,0,0.55)",
              }}
            >
              <span style={{ transform: spec.flip ? "scaleX(-1)" : "none", display: "inline-block" }}>
                {spec.name.slice(0, 1)}
              </span>
            </div>
            {/* right arm */}
            <div style={{ position: "absolute", right: -14, top: 2, transform: m.armsUp ? "rotate(150deg)" : "none", transformOrigin: "top center" }}>
              {m.armsUp ? (
                <motion.div
                  animate={{ rotate: [18, -18] }}
                  transition={{ duration: m.limbDuration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
                  style={{ width: 9, height: 30, background: spec.skin, borderRadius: 8, transformOrigin: "top center", border: "1px solid rgba(0,0,0,0.3)" }}
                />
              ) : (
                <Limb color={spec.skin} width={9} height={30} swing={m.armSwing} duration={m.limbDuration} />
              )}
            </div>
          </div>

          {/* pelvis cover + legs (overlap hides gap flash at wide swing) */}
          <div style={{ width: 30, height: 8, marginTop: -4, borderRadius: 6, background: spec.pants, border: "2px solid rgba(0,0,0,0.3)" }} />
          <div style={{ display: "flex", gap: 4, marginTop: -4 }}>
            <Limb color={spec.pants} width={11} height={28} swing={m.legSwing} duration={m.limbDuration} rounded={6} outline />
            <Limb color={spec.pants} width={11} height={28} swing={m.legSwing} duration={m.limbDuration} delay={half} rounded={6} outline />
          </div>

          {/* name tag */}
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              fontWeight: 800,
              padding: "2px 8px",
              borderRadius: 999,
              background: spec.shirt,
              color: "#111",
              border: "1px solid rgba(0,0,0,0.3)",
              transform: spec.flip ? "scaleX(-1)" : "none",
            }}
          >
            {spec.name}
          </div>
        </motion.div>
        </div>

        {/* shadow (4 stops to match body y keyframes) */}
        <motion.div
          animate={{ scaleX: [1, 0.9, 0.82, 1], opacity: [0.45, 0.32, 0.25, 0.45] }}
          transition={{ duration: m.limbDuration, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 56 * s, height: 8, borderRadius: 999, background: "rgba(0,0,0,0.5)", filter: "blur(4px)", marginTop: 2 }}
        />
      </motion.div>
    </div>
  );
}

export function HumanoidParade({ phase, disabled }: { phase: Phase; disabled: boolean }) {
  if (disabled) return <div style={fallback}>Reduced-motion on — walkers parked</div>;
  const mood = PHASE_TO_MOOD[phase];
  const moodLabel: Record<WalkerMood, string> = {
    idle: "idle sway",
    pace: "pacing",
    excited: "REVEAL party!",
    shuffle: "vote shuffle",
    march: "SCORE march",
  };
  return (
    <div style={track}>
      <div style={moodBadge}>
        {phase} · {moodLabel[mood]}
      </div>
      {AVATARS.map((a) => (
        <HumanoidWalker key={a.name} spec={a} mood={mood} />
      ))}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          initial={{ x: "0%" }}
          animate={{ x: "-50%" }}
          transition={{ duration: 3 + i * 2, repeat: Infinity, ease: "linear" }}
          style={{ ...groundLine, top: `${22 + i * 26}%`, opacity: 0.12 - i * 0.03 }}
        />
      ))}
    </div>
  );
}

const track: React.CSSProperties = {
  position: "relative",
  height: 380,
  overflow: "hidden",
  borderRadius: 14,
  background: "linear-gradient(180deg,#0f172a,#1e1b4b)",
  border: "1px solid rgba(255,255,255,0.1)",
  marginTop: 12,
};
const fallback: React.CSSProperties = { padding: 24, borderRadius: 14, background: "#1f2937", marginTop: 12 };
const groundLine: React.CSSProperties = {
  position: "absolute",
  left: 0,
  width: "200%",
  height: 2,
  background: "repeating-linear-gradient(90deg,#fff 0 24px,transparent 24px 48px)",
};
const moodBadge: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 10,
  fontSize: 12,
  fontWeight: 700,
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.2)",
  zIndex: 5,
  pointerEvents: "none",
};
