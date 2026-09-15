"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { useRoom, useCountdown, type RoomSnapshot } from "@/lib/realtime";
import { THEME, DISPLAY_FONT, IMAGES, outlineTitle, stageBg, answerCard, tvBtn } from "@/lib/theme";
import { Mascot, StageBg } from "@/components/Mascot";
import {
  ensureAudio,
  isMuted,
  setMuted,
  tick,
  timesUp,
  revealSting,
  fanfare,
  joinChime,
  startLobbyLoop,
} from "@/lib/sfx";
import {
  COLD_OPEN,
  LOBBY_TITLE,
  LOBBY_SUB,
  LOBBY_EMPTY,
  lobbyReady,
  roundTitle,
  INPUT_SUB,
  INPUT_ONELINERS,
  inputNudge,
  REVEAL_TITLE,
  REVEAL_SUB,
  REVEAL_ANON,
  VOTE_TITLE,
  VOTE_SUB,
  VOTE_BLIND,
  voteProgress,
  VOTE_NEED_MORE,
  SCORE_TITLE,
  winnerLine,
  SCORE_EMPTY,
} from "@/lib/hostCopy";
import {
  TimerIcon,
  MaskIcon,
  BallotIcon,
  TrophyIcon,
  CheckIcon,
  DrawIcon,
  LockIcon,
  MedalIcon,
} from "@/components/icons";
import { PlayerParade } from "@/components/PlayerParade";
import type { Phase } from "@/app/preview/HumanoidWalker";

const PHASE_STATUS: Record<Phase, string> = {
  LOBBY: "Waiting for players",
  INPUT: "Answers coming in",
  REVEAL: "Showtime — read them loud",
  VOTE: "Voting open",
  SCORE: "Results",
};

const grid = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const cardV = {
  hidden: { opacity: 0, y: 40, rotate: -2, scale: 0.92 },
  show: {
    opacity: 1,
    y: 0,
    rotate: 0,
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

function BtnLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
      {children}
    </span>
  );
}

function TimerBar({ left, total = 90 }: { left: number | null; total?: number }) {
  if (left === null) return null;
  const pct = Math.max(0, Math.min(1, left / total));
  const urgent = left <= 10;
  return (
    <div style={{ marginTop: 8, maxWidth: 520 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontFamily: DISPLAY_FONT,
          fontSize: 30,
          color: urgent ? "#ff5d5d" : "#fff",
        }}
      >
        <TimerIcon size={30} /> {left}s
      </div>
      <div style={{ height: 14, borderRadius: 999, border: "3px solid #111", background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
        <motion.div
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          style={{ height: "100%", background: urgent ? "#ff5d5d" : THEME.teal }}
        />
      </div>
    </div>
  );
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
  const [muted, setMutedState] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [oneLiner, setOneLiner] = useState(0);
  const lastLeft = useRef<number | null>(null);
  const lastPlayers = useRef(0);
  const lobbyAudio = useRef<HTMLAudioElement | null>(null);
  const [musicOk, setMusicOk] = useState(true);
  useEffect(() => {
    setMutedState(isMuted());
  }, []);
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
    if (ensureAudio()) setSoundOn(true);
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next && ensureAudio()) setSoundOn(true);
  }

  // Fire confetti + fanfare once per SCORE entry.
  useEffect(() => {
    if (room?.phase === "SCORE") {
      setBurst((b) => b + 1);
      fanfare();
    }
    if (room?.phase === "REVEAL") revealSting();
  }, [room?.phase, room?.current_round]);

  // Lobby entrance chime when the roster grows.
  useEffect(() => {
    const n = room?.players.length ?? 0;
    if (n > lastPlayers.current) joinChime();
    lastPlayers.current = n;
  }, [room?.players.length]);

  // Countdown ticks (last 5s) + times-up slam. Local only, from ends_at.
  useEffect(() => {
    if (left === null || left === lastLeft.current) return;
    lastLeft.current = left;
    if (left <= 5 && left > 0) tick(left);
    if (left === 0) timesUp();
  }, [left]);

  // Rotating dead-air one-liner during INPUT.
  useEffect(() => {
    if (room?.phase !== "INPUT") return;
    const id = setInterval(() => setOneLiner((i) => i + 1), 8000);
    return () => clearInterval(id);
  }, [room?.phase, room?.current_round]);

  // Lobby music: mp3 if present, else synth loop.
  useEffect(() => {
    const el = lobbyAudio.current;
    const lobby = room?.phase === "LOBBY" && soundOn && !muted;
    if (el && musicOk) {
      if (lobby) {
        el.volume = 0.3;
        void el.play().catch(() => {});
      } else {
        el.pause();
      }
      return;
    }
    if (!musicOk && lobby) {
      const stop = startLobbyLoop();
      return stop;
    }
  }, [room?.phase, soundOn, muted, musicOk]);

  // Auto-advance INPUT -> REVEAL when the timer expires.
  useEffect(() => {
    if (!room || room.phase !== "INPUT" || left !== 0) return;
    const key = `${code}:${room.current_round}`;
    if (autoFired.current === key) return;
    autoFired.current = key;
    post(`/api/rooms/${code}/next`, { to: "REVEAL" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, room?.phase, room?.current_round, code]);

  if (!room)
    return (
      <main style={{ ...stageBg, ...wrap }}>
        <h1 style={outlineTitle(64)}>{code}</h1>
        <p>Loading room…</p>
      </main>
    );

  const phase = room.phase as Phase;
  const submitted = room.counts?.submitted ?? room.submissions.length;
  const total = room.counts?.total ?? Math.max(room.players.length, 1);
  const totalVotes = room.counts?.voted ?? room.submissions.reduce((n, s) => n + (s.votes ?? 0), 0);
  const sortedScores = Object.entries(room.scores)
    .map(([sid, pts]) => ({ sid, name: nameOf(room, sid), pts }))
    .sort((a, b) => b.pts - a.pts);
  // Mascot swaps by phase: lobby idle, reveal/vote excited, score trophy.
  const mascotSrc =
    phase === "SCORE" ? IMAGES.score : phase === "LOBBY" ? IMAGES.lobby : IMAGES.reveal;
  const mascotBounce = phase === "REVEAL" ? 1.8 : phase === "VOTE" ? 1.4 : 1;

  return (
    <StageBg>
      <main style={{ ...stageBg, ...wrap }}>
        <Confetti burst={reduce ? 0 : burst} />
        <audio ref={lobbyAudio} loop preload="auto" onError={() => setMusicOk(false)}>
          <source src="/audio/lobby.ogg" type="audio/ogg" />
          <source src="/audio/lobby.mp3" type="audio/mpeg" />
        </audio>
        <button onClick={toggleMute} style={soundBtn} aria-label={muted ? "Unmute sound" : "Mute sound"}>
          {!soundOn ? "Tap for sound" : muted ? "Sound off" : "Sound on"}
        </button>
        {!clean && (
          <header style={topbar}>
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: DISPLAY_FONT, fontSize: 18, letterSpacing: 3, opacity: 0.8 }}>JOIN AT</div>
                <div style={outlineTitle(72)}>{room.code}</div>
                <div style={{ fontSize: 18, opacity: 0.85 }}>{joinUrl}</div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Join QR" width={150} height={150} style={{ background: "#fff", padding: 8, borderRadius: 14, border: "3px solid #111", boxShadow: "5px 5px 0 #111" }} />
              <div>
                <div style={{ fontFamily: DISPLAY_FONT, fontSize: 24 }}>
                  Round {Math.max(room.current_round, 1)} · {PHASE_STATUS[phase] ?? phase}
                </div>
                <TimerBar left={left} />
                <div style={{ marginTop: 6, fontSize: 18, opacity: 0.85 }}>Players: {room.players.length}</div>
              </div>
              <Mascot src={mascotSrc} alt="Saturday host" size={170} bounce={mascotBounce} />
            </div>
          </header>
        )}

        <AnimatePresence mode="wait">
          <motion.section key={room.phase + room.current_round} variants={phaseV} initial="hidden" animate="show" exit="exit">
            {room.phase === "LOBBY" && (
              <>
                <h2 style={outlineTitle(56)}>{LOBBY_TITLE}</h2>
                <p style={sub}>{COLD_OPEN}</p>
                <p style={{ ...sub, opacity: 0.75 }}>{LOBBY_SUB}</p>
                <PlayerParade phase="LOBBY" players={room.players} disabled={!!reduce} height={240} />
                <motion.ul variants={grid} initial="hidden" animate="show" style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {room.players.map((p, i) => (
                    <motion.li
                      key={p.session_id}
                      variants={cardV}
                      style={{ ...chip, background: CHIP_COLORS[i % CHIP_COLORS.length], transform: `rotate(${i % 2 ? 1.5 : -1.5}deg)` }}
                    >
                      {p.name}
                    </motion.li>
                  ))}
                </motion.ul>
                {room.players.length === 0 ? (
                  <p style={sub}>{LOBBY_EMPTY}</p>
                ) : (
                  <p style={{ fontSize: 22, fontWeight: 800 }}>{lobbyReady(room.players.length)}</p>
                )}
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} style={{ ...tvBtn, ...bigBtn }} onClick={() => post(`/api/rooms/${code}/start`, {})}>
                  Start round
                </motion.button>
              </>
            )}

            {room.phase === "INPUT" && (
              <>
                <h2 style={outlineTitle(48)}>{roundTitle(room.current_round)}</h2>
                <div style={promptHero}>{room.prompt}</div>
                <p style={sub}>{INPUT_SUB}</p>
                <p style={{ fontSize: 24, fontWeight: 800 }}>{inputNudge(submitted, total)}</p>
                <p style={{ fontSize: 18, opacity: 0.7, fontStyle: "italic" }}>
                  {INPUT_ONELINERS[(oneLiner + room.current_round) % INPUT_ONELINERS.length]}
                </p>
                <motion.div variants={grid} initial="hidden" animate="show" style={gridStyle}>
                  {room.players.map((p, i) => {
                    const done = room.submissions.some((s) => s.player_session === p.session_id);
                    return (
                      <motion.div key={p.session_id} variants={cardV} style={{ ...answerCard, ...card, opacity: done ? 1 : 0.65, transform: `rotate(${i % 2 ? 1 : -1}deg)` }}>
                        <div style={{ fontSize: 22, fontWeight: 800 }}>{p.name}</div>
                        <small style={{ opacity: 0.7, display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {done ? (
                            <>locked in <CheckIcon size={16} /></>
                          ) : (
                            "typing…"
                          )}
                        </small>
                      </motion.div>
                    );
                  })}
                </motion.div>
                <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                  <motion.button whileTap={{ scale: 0.96 }} style={{ ...tvBtn, ...bigBtn }} onClick={() => post(`/api/rooms/${code}/next`, { to: "REVEAL" })}>
                    <BtnLabel>Reveal <MaskIcon size={24} /></BtnLabel>
                  </motion.button>
                </div>
              </>
            )}

            {room.phase === "REVEAL" && (
              <>
                <h2 style={{ ...outlineTitle(52), display: "flex", alignItems: "center", gap: 12 }}>
                  <MaskIcon size={40} /> {REVEAL_TITLE}
                </h2>
                <div style={promptHero}>{room.prompt}</div>
                <p style={sub}>{REVEAL_SUB}</p>
                <motion.div variants={grid} initial="hidden" animate="show" style={gridStyle}>
                  {room.submissions.map((s, i) => (
                    <motion.div key={s.player_session} variants={cardV} whileHover={reduce ? undefined : { scale: 1.04, rotate: -1 }} style={{ ...answerCard, ...card, transform: `rotate(${i % 2 ? 1 : -1}deg)` }}>
                      {s.image_url ? (
                        <p style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 10 }}>
                          <DrawIcon size={26} /> (drawing)
                        </p>
                      ) : (
                        <p style={{ fontSize: 26, fontWeight: 800 }}>{s.text_content}</p>
                      )}
                      <small style={{ opacity: 0.6 }}>{REVEAL_ANON}</small>
                    </motion.div>
                  ))}
                </motion.div>
                <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                  <motion.button whileTap={{ scale: 0.96 }} style={{ ...tvBtn, ...bigBtn }} onClick={() => post(`/api/rooms/${code}/next`, { to: "VOTE" })}>
                    <BtnLabel>Start voting <BallotIcon size={24} /></BtnLabel>
                  </motion.button>
                </div>
              </>
            )}

            {room.phase === "VOTE" && (
              <>
                <h2 style={{ ...outlineTitle(52), display: "flex", alignItems: "center", gap: 12 }}>
                  <BallotIcon size={40} /> {VOTE_TITLE}
                </h2>
                <p style={sub}>{VOTE_SUB}</p>
                <p style={{ fontSize: 22, fontWeight: 800 }}>{voteProgress(totalVotes, total)}</p>
                {room.submissions.length <= 1 && <p style={sub}>{VOTE_NEED_MORE}</p>}
                <motion.div variants={grid} initial="hidden" animate="show" style={gridStyle}>
                  {room.submissions.map((s, i) => (
                    <motion.div key={s.player_session} variants={cardV} style={{ ...answerCard, ...card, transform: `rotate(${i % 2 ? 1 : -1}deg)` }}>
                      {s.image_url ? (
                        <p style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 10 }}>
                          <DrawIcon size={26} /> (drawing)
                        </p>
                      ) : (
                        <p style={{ fontSize: 26, fontWeight: 800 }}>{s.text_content}</p>
                      )}
                      <small style={{ opacity: 0.6, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <LockIcon size={16} /> {VOTE_BLIND}
                      </small>
                    </motion.div>
                  ))}
                </motion.div>
                <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
                  <motion.button whileTap={{ scale: 0.96 }} style={{ ...tvBtn, ...bigBtn }} onClick={() => post(`/api/rooms/${code}/next`, { to: "SCORE" })}>
                    <BtnLabel>Show scores <TrophyIcon size={24} /></BtnLabel>
                  </motion.button>
                </div>
              </>
            )}

            {room.phase === "SCORE" && (
              <>
                <h2 style={{ ...outlineTitle(52), display: "flex", alignItems: "center", gap: 12 }}>
                  <TrophyIcon size={40} /> {SCORE_TITLE}
                </h2>
                <PlayerParade phase="SCORE" players={room.players} disabled={!!reduce} height={200} />
                <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 16, minHeight: 220 }}>
                  {sortedScores.map((e, i) => (
                    <motion.div
                      key={e.sid}
                      layout
                      transition={{ type: "spring", stiffness: 200, damping: 26 }}
                      style={{ ...podiumBar, height: 80 + (sortedScores.length - i) * 30, background: i === 0 ? THEME.yellow : "#2a2350", color: i === 0 ? "#111" : "#fff" }}
                    >
                      <MedalIcon rank={i + 1} size={30} />
                      <strong>{e.name}</strong>
                      <AnimatePresence mode="popLayout">
                        <motion.span
                          key={e.pts}
                          initial={reduce ? {} : { scale: 1.6, color: "#fbbf24" }}
                          animate={{ scale: 1, color: i === 0 ? "#111" : "#fff" }}
                          transition={{ type: "spring", stiffness: 500, damping: 18 }}
                          style={{ fontWeight: 800, fontSize: 24, fontFamily: DISPLAY_FONT }}
                        >
                          {e.pts}
                        </motion.span>
                      </AnimatePresence>
                    </motion.div>
                  ))}
                  {sortedScores.length === 0 && <p style={{ opacity: 0.6 }}>{SCORE_EMPTY}</p>}
                </div>
                {sortedScores[0] && (
                  <p style={{ fontSize: 26, fontWeight: 800, fontFamily: DISPLAY_FONT }}>
                    <TrophyIcon size={28} /> {winnerLine(sortedScores[0].name)}
                  </p>
                )}
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} style={{ ...tvBtn, ...bigBtn }} onClick={() => post(`/api/rooms/${code}/next`, { to: "INPUT" })}>
                  Next round →
                </motion.button>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </main>
    </StageBg>
  );
}

const CHIP_COLORS = ["#ff2e9a", "#22ffcc", "#ffcf0d", "#60a5fa", "#a78bfa"];

const wrap: React.CSSProperties = { padding: 32, maxWidth: 1200, margin: "0 auto", color: "#fff", minHeight: "100dvh" };
const topbar: React.CSSProperties = { display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap", background: "rgba(0,0,0,0.35)", border: "3px solid #111", borderRadius: 18, padding: "16px 20px", boxShadow: "6px 6px 0 #111" };
const sub: React.CSSProperties = { fontSize: 20, opacity: 0.9 };
const promptHero: React.CSSProperties = {
  fontFamily: DISPLAY_FONT,
  fontSize: "clamp(28px, 4vw, 44px)",
  background: "#fff",
  color: "#111",
  border: "3px solid #111",
  borderRadius: 16,
  boxShadow: "6px 6px 0 #111",
  padding: "18px 22px",
  margin: "12px 0",
};
const chip: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: "#111", padding: "10px 18px", borderRadius: 999, border: "3px solid #111", boxShadow: "4px 4px 0 #111" };
const card: React.CSSProperties = { padding: 20, minHeight: 100 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 };
const bigBtn: React.CSSProperties = { padding: "16px 32px", fontSize: 24, marginTop: 12 };
const podiumBar: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 6, padding: 14, borderRadius: 14, border: "3px solid #111", boxShadow: "5px 5px 0 #111" };
const soundBtn: React.CSSProperties = { position: "fixed", bottom: 16, right: 16, zIndex: 60, padding: "10px 16px", fontSize: 15, fontWeight: 800, borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer" };
