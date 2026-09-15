"use client";
import { useMemo, useState } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from "motion/react";

import { HumanoidParade } from "./HumanoidWalker";
import type { Phase } from "./HumanoidWalker";
import { TimerIcon, MaskIcon, BallotIcon, TrophyIcon, MedalIcon } from "@/components/icons";

const PHASES: Phase[] = ["LOBBY", "INPUT", "REVEAL", "VOTE", "SCORE"];

const PHASE_ICON: Record<Phase, React.ReactNode> = {
  LOBBY: null,
  INPUT: null,
  REVEAL: <MaskIcon size={22} />,
  VOTE: <BallotIcon size={22} />,
  SCORE: <TrophyIcon size={22} />,
};

// ---------- shared variants ----------
const phaseVariants: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.98, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 220, damping: 24 },
  },
  exit: { opacity: 0, y: -24, scale: 0.98, filter: "blur(6px)", transition: { duration: 0.18 } },
};

const grid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

const card: Variants = {
  hidden: { opacity: 0, y: 40, rotateX: -60, scale: 0.9 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 20 },
  },
};

// ---------- walk-across parade now lives in HumanoidWalker.tsx ----------

// ---------- confetti ----------
type ConfettiPiece = { id: number; x: number; color: string; delay: number; size: number };

function Confetti({ burst }: { burst: number }) {
  const pieces = useMemo<ConfettiPiece[]>(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        id: i + burst * 1000,
        x: (i * 137) % 100,
        color: ["#f472b6", "#a78bfa", "#34d399", "#fbbf24", "#60a5fa"][i % 5],
        delay: (i % 20) * 0.02,
        size: 6 + ((i * 7) % 8),
      })),
    [burst]
  );
  if (burst === 0) return null;
  return (
    <div style={confettiLayer}>
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ x: `${p.x}vw`, y: "-5vh", rotate: 0, opacity: 1 }}
          animate={{ y: "110vh", rotate: 720, opacity: [1, 1, 0] }}
          transition={{ duration: 2.4 + (p.id % 5) * 0.3, delay: p.delay, ease: "easeIn" }}
          style={{ ...confettiPiece, background: p.color, width: p.size, height: p.size * 0.6 }}
        />
      ))}
    </div>
  );
}

type ScoreEntry = { name: string; pts: number };
const INITIAL_SCORES: ScoreEntry[] = [
  { name: "MOM", pts: 12 },
  { name: "DAD", pts: 9 },
  { name: "ZOE", pts: 14 },
  { name: "LEO", pts: 7 },
];

// ---------- main page ----------
export default function PreviewPage() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("REVEAL");
  const [votes, setVotes] = useState<Record<string, number>>({ Fox: 3, Turtle: 5, Bunny: 2 });
  const [scores, setScores] = useState<ScoreEntry[]>(INITIAL_SCORES);
  const [burst, setBurst] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [seconds, setSeconds] = useState(5);
  const urgent = seconds <= 5;

  const sortedScores = useMemo(() => [...scores].sort((a, b) => b.pts - a.pts), [scores]);

  return (
    <main style={page}>
      <Confetti burst={burst} />
      <div style={inner}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
          <p style={kicker}>motion/react — limits playground</p>
          <h1 style={title}>What Motion can do for Saturday</h1>
          <p style={sub}>
            TV-host first. All animations below are client-side only — driven by{" "}
            <code>room.phase</code> changes, never by server ticks. This page uses zero Supabase calls.
          </p>
          <div style={row}>
            <a href="/" style={linkBtn}>← Home</a>
            <span style={pill}>{reduce ? "reduced-motion detected" : "full motion"}</span>
            <span style={pill}>motion v13 · transform + opacity = 60fps</span>
          </div>
        </motion.div>

        {/* 1 — Phase theatre */}
        <section style={section}>
          <h2 style={h2}>1 · Phase theatre (the TV money shot)</h2>
          <p style={p}>AnimatePresence keyed on phase — exactly how /host will feel.</p>
          <div style={row}>
            {PHASES.map((ph) => (
              <motion.button
                key={ph}
                onClick={() => setPhase(ph)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={phase === ph ? activeChip : chip}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {PHASE_ICON[ph]} {ph}
                </span>
              </motion.button>
            ))}
          </div>
          <div style={stage}>
            <AnimatePresence mode="wait">
              <motion.div key={phase} variants={phaseVariants} initial="hidden" animate="show" exit="exit" style={stageCard}>
                <div style={{ fontSize: 13, opacity: 0.6 }}>PHASE: {phase}</div>
                <div style={{ fontSize: 34, fontWeight: 800 }}>
                  {phase === "LOBBY" && "Waiting for family…"}
                  {phase === "INPUT" && "Invent a family holiday…"}
                  {phase === "REVEAL" && "Drumroll — answers up!"}
                  {phase === "VOTE" && "Vote on phones now!"}
                  {phase === "SCORE" && "Scores + winner march!"}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* 2 — Walkers */}
        <section style={section}>
          <h2 style={h2}>2 · Humanoid player avatars — phase-reactive</h2>
          <p style={p}>
            MOM / DAD / ZOE / LEO walk with swinging arms + legs (transform/opacity only). Change phase above —{" "}
            LOBBY idles, REVEAL jumps with arms up, SCORE marches. Different duration = parallax depth.
          </p>
          <HumanoidParade phase={phase} disabled={!!reduce} />
        </section>

        {/* 3 — Reveal stagger */}
        <section style={section}>
          <h2 style={h2}>3 · REVEAL stagger flip</h2>
          <motion.div variants={grid} initial="hidden" whileInView="show" viewport={{ once: true }} style={gridStyle}>
            {["Pizza that sings 🎤", "Socks for cats 🧦", "Nap Olympics 😴", "Flying toaster 🍞", "Beard insurance 🧔", "Moon picnic 🌙"].map((t) => (
              <motion.div key={t} variants={card} whileHover={{ scale: 1.04, rotate: -1 }} style={answerCard}>
                <div style={{ fontSize: 20 }}>{t}</div>
                <small style={{ opacity: 0.6 }}>submitted · spring 260/20</small>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* 4 — Vote springs */}
        <section style={section}>
          <h2 style={h2}>4 · VOTE tally springs</h2>
          <p style={p}>Click to add votes — number pops via key change.</p>
          <div style={voteList}>
            {Object.entries(votes).map(([name, v]) => (
              <motion.button key={name} onClick={() => setVotes((s) => ({ ...s, [name]: s[name] + 1 }))} whileTap={{ scale: 0.96 }} style={voteRow}>
                <span>{name}</span>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={v}
                    initial={{ scale: 1.6, color: "#fbbf24" }}
                    animate={{ scale: 1, color: "#fff" }}
                    transition={{ type: "spring", stiffness: 500, damping: 18 }}
                    style={{ fontWeight: 800, fontSize: 22 }}
                  >
                    {v}
                  </motion.span>
                </AnimatePresence>
                <motion.div
                  animate={{ width: `${Math.min(100, v * 12)}%` }}
                  transition={{ type: "spring", stiffness: 160, damping: 22 }}
                  style={voteBar}
                />
              </motion.button>
            ))}
          </div>
        </section>

        {/* 5 — Podium + confetti */}
        <section style={section}>
          <h2 style={h2}>5 · SCORE podium (layout) + confetti</h2>
          <div style={row}>
            <motion.button
              onClick={() => {
                setScores((s) => s.map((e) => ({ ...e, pts: e.pts + Math.floor(Math.random() * 5) })));
                setBurst((b) => b + 1);
              }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              style={primaryBtn}
            >
              Random win + confetti
            </motion.button>
          </div>
          <div style={podium}>
            {sortedScores.map((e, i) => (
              <motion.div key={e.name} layout transition={{ type: "spring", stiffness: 200, damping: 26 }} style={{ ...podiumBar, height: 60 + (sortedScores.length - i) * 28 }}>
                <MedalIcon rank={i + 1} size={30} />
                <strong>{e.name}</strong>
                <span>{e.pts}</span>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 6 — Phone feel */}
        <section style={section}>
          <h2 style={h2}>6 · Phone feel: gestures, timer, success</h2>
          <div style={phoneGrid}>
            <div style={phoneCard}>
              <h3 style={h3}>Gestures</h3>
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.9 }} transition={{ duration: 0.15 }} style={primaryBtn}>
                whileTap feels snappy
              </motion.button>
              <motion.input
                placeholder="Focus me"
                whileFocus={{ scale: 1.02, borderColor: "#a78bfa" }}
                style={input}
              />
            </div>
            <div style={phoneCard}>
              <h3 style={h3}>Timer urgency</h3>
              <motion.div
                animate={urgent ? { x: [0, -6, 6, -4, 4, 0], scale: [1, 1.08, 1] } : { x: 0, scale: 1 }}
                transition={{ duration: 0.5, repeat: urgent ? Infinity : 0, repeatDelay: 1 }}
                style={{ ...timer, background: urgent ? "#dc2626" : "#1f2937" }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <TimerIcon size={24} /> {seconds}s {urgent ? "— HURRY!" : ""}
                </span>
              </motion.div>
              <input type="range" min={1} max={30} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} style={{ width: "100%" }} />
            </div>
            <div style={phoneCard}>
              <h3 style={h3}>Submit success</h3>
              <motion.button
                onClick={() => setSubmitted((s) => !s)}
                whileTap={{ scale: 0.95 }}
                animate={{ backgroundColor: submitted ? "#059669" : "#7c3aed" }}
                style={primaryBtn}
              >
                {submitted ? "Submitted" : "Submit answer"}
              </motion.button>
              <AnimatePresence>
                {submitted && (
                  <motion.svg width={72} height={72} viewBox="0 0 72 72" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} style={{ marginTop: 12 }}>
                    <motion.circle cx={36} cy={36} r={30} fill="none" stroke="#34d399" strokeWidth={5} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
                    <motion.path d="M24 37l8 8 16-16" fill="none" stroke="#34d399" strokeWidth={6} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.3 }} />
                  </motion.svg>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* 7 — Limits */}
        <section style={section}>
          <h2 style={h2}>7 · Where Motion stops (the honest limits)</h2>
          <div style={limitsGrid}>
            <div style={limitCard}>
              <strong>Buttery (transform/opacity)</strong>
              <motion.div animate={{ x: [0, 200, 0], rotate: [0, 180, 360] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} style={limitBox} />
              <p style={p}>x, y, scale, rotate, opacity run on GPU.</p>
            </div>
            <div style={limitCard}>
              <strong>Janky (layout props)</strong>
              <motion.div animate={{ width: [80, 240, 80] }} transition={{ duration: 3, repeat: Infinity }} style={{ ...limitBox, background: "#dc2626" }} />
              <p style={p}>width/height/top trigger reflow — avoid per-frame.</p>
            </div>
            <div style={limitCard}>
              <strong>Not Motion&apos;s job</strong>
              <p style={p}>Per-pixel particles (&gt;200), skeletal rigs, canvas drawing strokes per-mousemove (banned by AGENTS.md), server-tick animation. Use canvas/WebGL there.</p>
            </div>
          </div>
          <p style={p}>
            Rule for Saturday: animate <code>room.phase</code> transitions + local gestures only. Timers broadcast{" "}
            <code>ends_at</code> once; phones count down with <code>useCountdown()</code> — never animate from Realtime ticks.
          </p>
        </section>
      </div>
    </main>
  );
}

// ---------- styles ----------
const page: React.CSSProperties = {
  minHeight: "100dvh",
  background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(167,139,250,0.18), transparent 70%), linear-gradient(160deg, #020617, #0b0a2a 55%, #1e1b4b)",
  color: "#fff",
  padding: "32px 20px 80px",
};
const inner: React.CSSProperties = { maxWidth: 980, margin: "0 auto" };
const kicker: React.CSSProperties = { color: "#a78bfa", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", fontSize: 12, margin: 0 };
const title: React.CSSProperties = { fontSize: "clamp(2rem,6vw,3.2rem)", margin: "8px 0", letterSpacing: "-0.02em" };
const sub: React.CSSProperties = { opacity: 0.75, lineHeight: 1.6, maxWidth: 720 };
const section: React.CSSProperties = { marginTop: 48, padding: 24, borderRadius: 16, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" };
const h2: React.CSSProperties = { margin: "0 0 8px", fontSize: 24 };
const h3: React.CSSProperties = { margin: "0 0 12px", fontSize: 18 };
const p: React.CSSProperties = { opacity: 0.7, lineHeight: 1.6 };
const row: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 12 };
const linkBtn: React.CSSProperties = { color: "#fff", textDecoration: "none", padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)" };
const pill: React.CSSProperties = { fontSize: 12, padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" };
const chip: React.CSSProperties = { padding: "8px 14px", borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer" };
const activeChip: React.CSSProperties = { ...chip, background: "#7c3aed", borderColor: "#7c3aed" };
const stage: React.CSSProperties = { marginTop: 16, minHeight: 150 };
const stageCard: React.CSSProperties = { padding: 28, borderRadius: 14, background: "#1e1b4b", border: "1px solid rgba(167,139,250,0.4)" };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 14, marginTop: 12, perspective: 800 };
const answerCard: React.CSSProperties = { background: "#22203a", padding: 18, borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", minHeight: 90 };
const voteList: React.CSSProperties = { display: "grid", gap: 10, marginTop: 12 };
const voteRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 12, background: "#1f2937", color: "#fff", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", position: "relative", overflow: "hidden", textAlign: "left" as const };
const voteBar: React.CSSProperties = { position: "absolute", left: 0, bottom: 0, height: 3, background: "#a78bfa" };
const podium: React.CSSProperties = { display: "flex", gap: 12, alignItems: "flex-end", marginTop: 16, minHeight: 220 };
const podiumBar: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 6, padding: 14, borderRadius: 12, background: "#312e81", border: "1px solid rgba(255,255,255,0.15)" };
const primaryBtn: React.CSSProperties = { padding: "14px 20px", fontSize: 16, fontWeight: 700, borderRadius: 10, background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer" };
const phoneGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 12 };
const phoneCard: React.CSSProperties = { background: "rgba(0,0,0,0.3)", padding: 18, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)" };
const input: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", padding: 12, marginTop: 10, borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.4)", color: "#fff", fontSize: 16, outline: "none" };
const timer: React.CSSProperties = { padding: 16, borderRadius: 12, fontSize: 22, fontWeight: 800, textAlign: "center" as const, marginBottom: 10 };
const confettiLayer: React.CSSProperties = { position: "fixed", inset: 0, pointerEvents: "none", zIndex: 50, overflow: "hidden" };
const confettiPiece: React.CSSProperties = { position: "absolute", top: 0, borderRadius: 2 };
const limitsGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14, marginTop: 12 };
const limitCard: React.CSSProperties = { background: "rgba(0,0,0,0.3)", padding: 16, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)" };
const limitBox: React.CSSProperties = { width: 80, height: 40, borderRadius: 8, background: "#059669", margin: "12px 0" };
