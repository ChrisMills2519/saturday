"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useRoom, useCountdown, type RoomSnapshot } from "@/lib/realtime";

const grid = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const cardV = {
  hidden: { opacity: 0, y: 40, rotateX: -60, scale: 0.9 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 260, damping: 20 },
  },
};
const phaseV = {
  hidden: { opacity: 0, y: 32, scale: 0.98 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 220, damping: 24 },
  },
  exit: { opacity: 0, y: -24, scale: 0.98, transition: { duration: 0.18 } },
};

function Confetti({ burst }: { burst: number }) {
  const pieces = useMemo(
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

function nameOf(room: RoomSnapshot, sessionId: string): string {
  return room.players.find((p) => p.session_id === sessionId)?.name ?? sessionId.slice(0, 4);
}

export default function HostPage({ params }: { params: { code: string } }) {
  const { code } = params;
  const [initial, setInitial] = useState<RoomSnapshot | null>(null);
  const reduce = useReducedMotion();
  const [burst, setBurst] = useState(0);
  const autoFired = useRef("");

  useEffect(() => {
    fetch(`/api/rooms/${code}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setInitial)
      .catch(() => {});
  }, [code]);

  const room = useRoom(code, initial);
  const left = useCountdown(room?.ends_at ?? null);
  const [origin, setOrigin] = useState(process.env.NEXT_PUBLIC_APP_URL ?? "");
  useEffect(() => {
    if (!origin && typeof window !== "undefined") setOrigin(window.location.origin);
  }, [origin]);
  const [clean, setClean] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") setClean(window.location.search.includes("clean=1"));
  }, []);
  const joinUrl = origin ? `${origin.replace(/\/$/, "")}/play/${code}` : `/play/${code}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;

  async function post(path: string, body?: unknown) {
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  // Fire confetti once per SCORE entry.
  useEffect(() => {
    if (room?.phase === "SCORE") setBurst((b) => b + 1);
  }, [room?.phase, room?.current_round]);

  // Auto-advance INPUT -> REVEAL when the timer expires so an AFK host
  // never stalls phones. Server still authorizes the transition.
  useEffect(() => {
    if (!room || room.phase !== "INPUT" || left !== 0) return;
    const key = `${code}:${room.current_round}`;
    if (autoFired.current === key) return;
    autoFired.current = key;
    post(`/api/rooms/${code}/next`, { to: "REVEAL" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, room?.phase, room?.current_round, code]);

  if (!room) return <main style={wrap}><h1>{code}</h1><p>Loading room…</p></main>;

  const submitted = room.submissions.length;
  const total = Math.max(room.players.length, 1);
  const totalVotes = room.submissions.reduce((n, s) => n + (s.votes ?? 0), 0);
  const sortedScores = Object.entries(room.scores)
    .map(([sid, pts]) => ({ sid, name: nameOf(room, sid), pts }))
    .sort((a, b) => b.pts - a.pts);
  const urgent = left !== null && left <= 10;

  return (
    <main style={wrap}>
      <Confetti burst={reduce ? 0 : burst} />
      {!clean && (
        <header style={{ display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 20, opacity: 0.7 }}>JOIN AT</div>
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: 8 }}>{room.code}</div>
            <div style={{ fontSize: 20 }}>{joinUrl}</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Join QR" width={180} height={180} style={{ background: "#fff", padding: 8, borderRadius: 12 }} />
          <div style={{ fontSize: 28 }}>
            <div>Phase: {room.phase}</div>
            {left !== null && (
              <motion.div
                animate={urgent && !reduce ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.5, repeat: urgent && !reduce ? Infinity : 0, repeatDelay: 1 }}
                style={{ color: urgent ? "#f87171" : undefined, fontWeight: 800 }}
              >
                ⏱ {left}s
              </motion.div>
            )}
            <div>Players: {room.players.length}</div>
          </div>
        </header>
      )}

      <AnimatePresence mode="wait">
        <motion.section key={room.phase + room.current_round} variants={phaseV} initial="hidden" animate="show" exit="exit">
          {room.phase === "LOBBY" && (
            <>
              <h2 style={h2}>Lobby</h2>
              <motion.ul variants={grid} initial="hidden" animate="show" style={{ listStyle: "none", padding: 0 }}>
                {room.players.map((p) => (
                  <motion.li key={p.session_id} variants={cardV} style={li}>{p.name}</motion.li>
                ))}
              </motion.ul>
              {room.players.length === 0 && <p style={{ opacity: 0.6 }}>Waiting for family to join…</p>}
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} style={btn} onClick={() => post(`/api/rooms/${code}/start`, {})}>
                Start round
              </motion.button>
            </>
          )}

          {room.phase === "INPUT" && (
            <>
              <h2 style={h2}>{room.prompt}</h2>
              <p style={{ fontSize: 22, opacity: 0.8 }}>
                {submitted}/{total} submitted{submitted === total && total > 0 ? " — everyone’s in!" : "…"}
              </p>
              {/* Blind: placeholder cards only, answers stay secret until REVEAL. */}
              <motion.div variants={grid} initial="hidden" animate="show" style={gridStyle}>
                {room.players.map((p) => {
                  const done = room.submissions.some((s) => s.player_session === p.session_id);
                  return (
                    <motion.div key={p.session_id} variants={cardV} style={{ ...card, opacity: done ? 1 : 0.5 }}>
                      <div style={{ fontSize: 22, fontWeight: 700 }}>{p.name}</div>
                      <small style={{ opacity: 0.7 }}>{done ? "locked in ✓" : "typing…"}</small>
                    </motion.div>
                  );
                })}
              </motion.div>
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <motion.button whileTap={{ scale: 0.96 }} style={btn} onClick={() => post(`/api/rooms/${code}/next`, { to: "REVEAL" })}>
                  Reveal 🎭
                </motion.button>
              </div>
            </>
          )}

          {room.phase === "REVEAL" && (
            <>
              <h2 style={h2}>🎭 {room.prompt}</h2>
              <p style={{ opacity: 0.7 }}>Read them aloud. Drumroll…</p>
              <motion.div variants={grid} initial="hidden" animate="show" style={gridStyle}>
                {room.submissions.map((s) => (
                  <motion.div key={s.player_session} variants={cardV} whileHover={reduce ? undefined : { scale: 1.04, rotate: -1 }} style={card}>
                    <p style={{ fontSize: 24 }}>{s.image_url ? "🎨 (drawing)" : s.text_content}</p>
                    <small style={{ opacity: 0.6 }}>anonymous… for now</small>
                  </motion.div>
                ))}
              </motion.div>
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <motion.button whileTap={{ scale: 0.96 }} style={btn} onClick={() => post(`/api/rooms/${code}/next`, { to: "VOTE" })}>
                  Start voting 🗳️
                </motion.button>
              </div>
            </>
          )}

          {room.phase === "VOTE" && (
            <>
              <h2 style={h2}>🗳️ Vote on your phones!</h2>
              <p style={{ fontSize: 22, opacity: 0.8 }}>{totalVotes}/{total} voted — tallies hidden until scores…</p>
              {room.submissions.length <= 1 && (
                <p style={{ fontSize: 18, opacity: 0.7 }}>Need 2+ answers to vote (solo players can&apos;t vote for themselves) — invite more phones or skip to scores.</p>
              )}
              <motion.div variants={grid} initial="hidden" animate="show" style={gridStyle}>
                {room.submissions.map((s) => (
                  <motion.div key={s.player_session} variants={cardV} style={card}>
                    <p style={{ fontSize: 24 }}>{s.image_url ? "🎨 (drawing)" : s.text_content}</p>
                    <small style={{ opacity: 0.6 }}>🔒 blind vote</small>
                  </motion.div>
                ))}
              </motion.div>
              <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                <motion.button whileTap={{ scale: 0.96 }} style={btn} onClick={() => post(`/api/rooms/${code}/next`, { to: "SCORE" })}>
                  Show scores 🏆
                </motion.button>
              </div>
            </>
          )}

          {room.phase === "SCORE" && (
            <>
              <h2 style={h2}>🏆 Scores</h2>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 16, minHeight: 220 }}>
                {sortedScores.map((e, i) => (
                  <motion.div
                    key={e.sid}
                    layout
                    transition={{ type: "spring", stiffness: 200, damping: 26 }}
                    style={{ ...podiumBar, height: 60 + (sortedScores.length - i) * 28 }}
                  >
                    <span style={{ fontSize: 28 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🙂"}</span>
                    <strong>{e.name}</strong>
                    <AnimatePresence mode="popLayout">
                      <motion.span
                        key={e.pts}
                        initial={reduce ? {} : { scale: 1.6, color: "#fbbf24" }}
                        animate={{ scale: 1, color: "#fff" }}
                        transition={{ type: "spring", stiffness: 500, damping: 18 }}
                        style={{ fontWeight: 800, fontSize: 22 }}
                      >
                        {e.pts}
                      </motion.span>
                    </AnimatePresence>
                  </motion.div>
                ))}
                {sortedScores.length === 0 && <p style={{ opacity: 0.6 }}>No votes yet — play a round!</p>}
              </div>
              {sortedScores[0] && <p style={{ fontSize: 24 }}>Winner: {sortedScores[0].name}! 🎉</p>}
              <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} style={btn} onClick={() => post(`/api/rooms/${code}/next`, { to: "INPUT" })}>
                Next round →
              </motion.button>
            </>
          )}
        </motion.section>
      </AnimatePresence>
    </main>
  );
}

const wrap: React.CSSProperties = { padding: 32, maxWidth: 1200, margin: "0 auto", color: "#fff", background: "#111", minHeight: "100dvh" };
const h2: React.CSSProperties = { fontSize: 40 };
const li: React.CSSProperties = { fontSize: 24, background: "#222", padding: "10px 16px", borderRadius: 10, margin: "6px 0" };
const card: React.CSSProperties = { background: "#222", padding: 20, borderRadius: 12, minHeight: 100, perspective: 800 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, perspective: 800 };
const btn: React.CSSProperties = { padding: "14px 28px", fontSize: 20, borderRadius: 10, background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer", marginTop: 12 };
const podiumBar: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 6, padding: 14, borderRadius: 12, background: "#312e81", border: "1px solid rgba(255,255,255,0.15)" };
