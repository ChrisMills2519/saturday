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
  revealHit,
  startVoteBed,
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
  FINAL_TITLE,
  FINAL_SUB,
  AWARDS_TITLE,
  awardCrowdFavorite,
  awardDarkHorse,
  awardNovelist,
  awardMinimalist,
  REMATCH_LABEL,
  ONE_MORE_LABEL,
  roundOf,
  winnerLine,
  SCORE_EMPTY,
  roundWinnerLine,
  nextRoundLine,
  EXTEND_LABEL,
  SKIP_LABEL,
  HOST_HINT,
  REVEAL_HINT,
  MVP_TITLE,
} from "@/lib/hostCopy";
import {
  TimerIcon,
  MaskIcon,
  BallotIcon,
  TrophyIcon,
  CheckIcon,
  LockIcon,
  MedalIcon,
} from "@/components/icons";
import { PlayerParade } from "@/components/PlayerParade";
import { hostHeaders, setHostToken, getHostToken } from "@/lib/hostToken";
import {
  unlockVoice,
  isVoiceEnabled,
  setVoiceEnabled,
  getSarcasmMode,
  setSarcasmMode,
  cancelVoice,
  speak,
  isKokoroEnabled,
  setKokoroEnabled,
  kokoroReady,
  pregenVoice,
  type SarcasmMode,
} from "@/lib/voice";
import { getKokoroVoice, setKokoroVoice, type KokoroVoiceId } from "@/lib/voiceKokoro";
import { phaseLine, saySlot, sayAnswer, scoreExtras, shutUp, estimateMs } from "@/lib/hostLines";
import { isFinalRound, MAX_PLAYERS } from "@/lib/gameEngine";
import type { Phase } from "@/app/preview/HumanoidWalker";

const PHASE_STATUS: Record<Phase, string> = {
  LOBBY: "Who's in?",
  INPUT: "What have you got?",
  REVEAL: "Whose is whose?",
  VOTE: "Which one?",
  SCORE: "Who won?",
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

function TimerBar({ left, total = 60 }: { left: number | null; total?: number }) {
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
          color: urgent ? "#ff5d5d" : "#fff",
        }}
      >
        <TimerIcon size={30} /> {left}s
      </div>
      <div style={{ height: 14, borderRadius: 999, border: "3px solid #111", background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
        <motion.div
          // GPU-friendly: scaleX on a full-width child, never layout width.
          animate={{ scaleX: pct }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          style={{ height: "100%", width: "100%", transformOrigin: "left", background: urgent ? "#ff5d5d" : THEME.teal }}
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

  // 404 detection: a wrong/expired room code should not spin on "Loading…" forever.
  const [deadRoom, setDeadRoom] = useState(false);
  useEffect(() => {
    fetch(`/api/rooms/${code}`, { cache: "no-store" })
      .then((r) => {
        if (r.status === 404) {
          setDeadRoom(true);
          return null;
        }
        return r.json();
      })
      .then((snap) => snap && setInitial(snap))
      .catch(() => {});
  }, [code]);

  const room = useRoom(code, initial);
  const left = useCountdown(room?.ends_at ?? null);
  const [muted, setMutedState] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  // Host voice: separate kill-switch from SFX mute, sarcasm bank persisted.
  const [voiceOn, setVoiceOnState] = useState(true);
  const [sarcasm, setSarcasmState] = useState<SarcasmMode>("family");
  // Neural voice (Kokoro full swap): warms in LOBBY, Tier 1 until ready.
  const [kokoroOn, setKokoroOnState] = useState(true);
  const [kokoroVoice, setKokoroVoiceState] = useState<KokoroVoiceId>("bm_fable");
  const [kokoroPct, setKokoroPct] = useState(0);
  const [kokoroIsReady, setKokoroIsReady] = useState(false);
  const usedLines = useRef<Set<string>>(new Set());
  const stallFired = useRef("");
  const extrasTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    setVoiceOnState(isVoiceEnabled());
    setSarcasmState(getSarcasmMode());
    setKokoroOnState(isKokoroEnabled());
    setKokoroVoiceState(getKokoroVoice());
    setKokoroIsReady(kokoroReady());
  }, []);
  // Poll neural warmup progress (cheap, LOBBY-only display).
  useEffect(() => {
    if (!kokoroOn || kokoroIsReady) return;
    const id = setInterval(() => {
      void import("@/lib/voiceKokoro")
        .then((m) => {
          setKokoroPct(m.kokoroProgress());
          if (m.isKokoroReady()) {
            setKokoroIsReady(true);
            clearInterval(id);
          }
        })
        .catch(() => {});
    }, 500);
    return () => clearInterval(id);
  }, [kokoroOn, kokoroIsReady]);
  // REVEAL-entry pre-gen: subs are known — cache card audio so slams play instantly.
  useEffect(() => {
    if (!room || room.phase !== "REVEAL") return;
    if (!kokoroOn || !kokoroIsReady) return;
    const lines = room.submissions.map((s, i) => {
      const clean = (s.text_content ?? "").replace(/https?:\/\/\S+/g, "link").slice(0, 120);
      if (s.image_url && !clean) return { text: "What am I looking at here, art or accident?", type: "aside" as const };
      const prefix = room.submissions.length > 1 ? `Number ${i + 1}... ` : "";
      return { text: `${prefix}${clean}`, type: "setup" as const };
    });
    pregenVoice(lines);
  }, [room?.phase, room?.current_round, kokoroOn, kokoroIsReady]);
  const [rounds, setRounds] = useState(3);
  const [gameType, setGameType] = useState<"text" | "draw">("text");
  const [customPrompt, setCustomPrompt] = useState("");
  const [startErr, setStartErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [oneLiner, setOneLiner] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [tallyShown, setTallyShown] = useState(false);
  // Timer bar total: INPUT 60s, VOTE 30s, +30 per successful extend.
  const [timerTotal, setTimerTotal] = useState(60);
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
    unlockVoice();
    if (isVoiceEnabled()) setVoiceOnState(true);
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...hostHeaders(code) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  // A TV tab opened on another device just plays as a spectator screen until
  // it starts a round, at which point the server mints/re-plays a host token
  // and we save it here (so UI like kick buttons appears).
  const [hasToken, setHasTokenState] = useState(() => !!getHostToken(code));

  async function advance(to: string) {
    if (advancing) return;
    setAdvancing(true);
    setActionErr(null);
    try {
      const { ok, data } = await post(`/api/rooms/${code}/next`, { to });
      if (!ok) setActionErr(`Couldn't advance: ${data?.error ?? "unknown"}`);
    } finally {
      setAdvancing(false);
    }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (next) cancelVoice();
    if (!next && ensureAudio()) setSoundOn(true);
  }

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceEnabled(next);
    setVoiceOnState(next);
    unlockVoice();
  }

  function switchSarcasm(mode: SarcasmMode) {
    setSarcasmMode(mode);
    setSarcasmState(mode);
  }

  function switchKokoro(on: boolean) {
    setKokoroEnabled(on);
    setKokoroOnState(on);
    if (on) {
      setKokoroIsReady(kokoroReady());
      unlockVoice();
    }
  }

  function switchKokoroVoice(v: KokoroVoiceId) {
    setKokoroVoice(v);
    setKokoroVoiceState(v);
  }

  // Fire confetti + fanfare once per SCORE entry.
  useEffect(() => {
    if (room?.phase === "SCORE") {
      setBurst((b) => b + 1);
      fanfare();
    }
    if (room?.phase === "REVEAL") revealSting();
  }, [room?.phase, room?.current_round]);

  // Reset the one-at-a-time reveal counter whenever the round/phase changes.
  const answerCount = room?.submissions.length ?? 0;
  useEffect(() => {
    setRevealed(0);
    setTallyShown(false);
    setTimerTotal(room?.phase === "VOTE" ? 30 : 60);
  }, [room?.phase, room?.current_round]);

  // Auto-slam the next answer card while REVEAL is on screen (host can also tap).
  // Reduced motion + "Page pace" toggle: no auto-slam — host taps/Space to reveal.
  const [autoSlam, setAutoSlam] = useState(true);
  useEffect(() => {
    if (room?.phase !== "REVEAL") return;
    if (reduce || !autoSlam) return;
    if (revealed >= answerCount) return;
    const id = setTimeout(() => {
      setRevealed((n) => Math.min(answerCount, n + 1));
      revealHit();
    }, revealed === 0 ? 700 : 2300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, revealed, answerCount, reduce, autoSlam]);

  // Space / click on the TV slams the next answer early.
  useEffect(() => {
    if (room?.phase !== "REVEAL") return;
    const bump = () => setRevealed((n) => Math.min(answerCount, n + 1));
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        bump();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [room?.phase, answerCount]);

  // Tally drama: let bars grow from zero when SCORE appears.
  useEffect(() => {
    if (room?.phase !== "SCORE") return;
    setTallyShown(false);
    const id = setTimeout(() => setTallyShown(true), reduce ? 0 : 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, room?.current_round, reduce]);

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

  // Music beds: lobby track in LOBBY, a tense pulse during VOTE.
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

  // Vote bed: low pulse so the room feels the clock without per-second broadcasts.
  useEffect(() => {
    if (room?.phase !== "VOTE" || !soundOn || muted) return;
    return startVoteBed();
  }, [room?.phase, soundOn, muted]);

  // --- Host voice ---------------------------------------------------------
  // Phase-entry opener. New game (LOBBY) resets the anti-repeat set.
  // SCORE winner is sticky (uninterruptible) with extras queued behind it.
  useEffect(() => {
    if (!room || !soundOn || muted || !voiceOn) return;
    extrasTimers.current.forEach(clearTimeout);
    extrasTimers.current = [];
    if (room.phase === "LOBBY") {
      usedLines.current = new Set();
      stallFired.current = "";
    }
    const line = phaseLine(room.phase, sarcasm, usedLines.current);
    if (!line) return;
    if (room.phase === "SCORE") {
      shutUp();
      // Winner mic-drop: uninterruptible, extras chained behind its length.
      speak(line.text, { type: line.type, priority: line.priority, sticky: true });
      const leadMs = estimateMs(line.text);
      scoreExtras(room.submissions, sarcasm, usedLines.current, leadMs);
      if (room.submissions.length >= 2) {
        const id = setTimeout(() => saySlot("score_award", sarcasm, usedLines.current), leadMs + 8000);
        extrasTimers.current.push(id);
      }
      return;
    }
    shutUp();
    speak(line.text, { type: line.type, priority: line.priority });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.phase, room?.current_round, soundOn, muted, voiceOn, sarcasm]);

  // REVEAL walk: speak each card as it slams (auto or tap/Space).
  useEffect(() => {
    if (!room || room.phase !== "REVEAL") return;
    if (!soundOn || muted || !voiceOn) return;
    if (revealed < 1) return;
    const sub = room.submissions[revealed - 1];
    if (!sub) return;
    // Small pre-beat so the card lands visually first.
    const id = setTimeout(
      () => sayAnswer(sub, sarcasm, usedLines.current, revealed - 1, room.submissions.length),
      250
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, room?.phase, soundOn, muted, voiceOn, sarcasm]);

  // INPUT dead air: voice the rotating one-liner (priority 1 — drops if busy).
  useEffect(() => {
    if (room?.phase !== "INPUT") return;
    if (!soundOn || muted || !voiceOn) return;
    if (oneLiner === 0) return; // opener already covered round start
    saySlot("input_nudge", sarcasm, usedLines.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oneLiner]);

  // INPUT stall jab: once per round when the clock bleeds with stragglers.
  useEffect(() => {
    if (!room || room.phase !== "INPUT") return;
    if (!soundOn || muted || !voiceOn) return;
    if (left === null || left > 15 || left <= 0) return;
    if (submitted >= total) return;
    const key = `${code}:${room.current_round}`;
    if (stallFired.current === key) return;
    stallFired.current = key;
    saySlot("input_stall", sarcasm, usedLines.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, room?.phase]);

  // Keep the LOBBY rounds stepper in sync with the server (default 3).
  useEffect(() => {
    if (room?.phase === "LOBBY" && typeof room.total_rounds === "number") {
      setRounds(room.total_rounds);
      setStartErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.total_rounds, room?.phase]);

  async function startGame() {
    setStartErr(null);
    const { ok, data } = await post(`/api/rooms/${code}/start`, {
      total_rounds: rounds,
      game_type: gameType,
      ...(customPrompt.trim().length > 1 ? { prompt: customPrompt.trim() } : {}),
    });
    if (!ok) setStartErr(data?.error === "need 2+ players to start" ? "Need 2+ players — who's joining?" : `Couldn't start: ${data?.error ?? "unknown"}`);
    // Replacement-TV takeover: the server mints a new token and returns it, so
    // this device becomes the official host for next/kick/extend.
    if (ok && data?.host_token) {
      setHostToken(code, data.host_token as string);
      setHasTokenState(true);
    }
  }

  async function extendTime() {
    // Don't race the last-second auto-advance: extending at 0-2s just 400s.
    if (left !== null && left <= 2) {
      setActionErr("Clock's basically out — whose flip is it?");
      return;
    }
    setActionErr(null);
    const { ok, data } = await post(`/api/rooms/${code}/extend`, { seconds: 30 });
    if (!ok) setActionErr(`Couldn't add time: ${data?.error ?? "unknown"}`);
    else {
      setTimerTotal((t) => t + 30);
      if (voiceOn && !muted) saySlot("extend_snark", sarcasm, usedLines.current);
    }
  }

  async function kick(target: string, label: string) {
    if (!window.confirm(`Remove ${label} from the game?`)) return;
    setActionErr(null);
    const { ok, data } = await post(`/api/rooms/${code}/kick`, { target_session: target });
    if (!ok) setActionErr(`Couldn't remove ${label}: ${data?.error ?? "unknown"}`);
  }

  // Auto-advance INPUT -> REVEAL and VOTE -> SCORE when the timer expires.
  // Server clears ends_at on the destination phase, so left hits 0 once.
  // Guard: empty rounds don't march themselves. If nothing was submitted/voted,
  // surface a prompt to the host instead of advancing into a content-less phase.
  useEffect(() => {
    if (!room || left !== 0) return;
    if (room.phase !== "INPUT" && room.phase !== "VOTE") return;
    const submitted = room.counts?.submitted ?? room.submissions.length;
    const totalVotes = room.counts?.voted ?? room.submissions.reduce((n, s) => n + (s.votes ?? 0), 0);
    if (room.phase === "INPUT" && submitted < 2) {
      setActionErr("Time's up with thin answers — whose call: Reveal or wait?");
      return;
    }
    if (room.phase === "VOTE" && totalVotes < 1) {
      setActionErr("No votes yet — whose call: scores or more time?");
      return;
    }
    const to = room.phase === "INPUT" ? "REVEAL" : "SCORE";
    const key = `${code}:${room.current_round}:${room.phase}`;
    if (autoFired.current === key) return;
    autoFired.current = key;
    post(`/api/rooms/${code}/next`, { to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, room?.phase, room?.current_round, code]);

  // Focus the phase heading on change so screen readers announce it.
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, [room?.phase, room?.current_round]);

  if (deadRoom)
    return (
      <main style={{ ...stageBg, ...wrap, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <h1 style={outlineTitle(64)}>ROOM NOT FOUND</h1>
        <p style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>“{code}” doesn&apos;t exist or expired. Create a new game.</p>
        <a href="/" style={{ ...tvBtn, padding: "16px 32px", fontSize: 22, marginTop: 16, textDecoration: "none", display: "inline-block" }}>
          Create a game
        </a>
      </main>
    );

  if (!room)
    return (
      <main style={{ ...stageBg, ...wrap }}>
        <h1 style={outlineTitle(64)}>{code}</h1>
        <p>Loading room…</p>
      </main>
    );

  const phase = room.phase as Phase;
  const totalRounds = room.total_rounds ?? 3;
  const final = isFinalRound(room.current_round, totalRounds);
  const submitted = room.counts?.submitted ?? room.submissions.length;
  const total = room.counts?.total ?? Math.max(room.players.length, 1);
  const totalVotes = room.counts?.voted ?? room.submissions.reduce((n, s) => n + (s.votes ?? 0), 0);
  const sortedScores = Object.entries(room.scores)
    .map(([sid, pts]) => ({ sid, name: nameOf(room, sid), pts }))
    .sort((a, b) => b.pts - a.pts);
  // Round MVP: the answer with the most votes this round (ties → earliest).
  const roundMvp = room.submissions.reduce<null | (typeof room.submissions)[number]>(
    (best, s) => (!best || (s.votes ?? 0) > (best.votes ?? 0) ? s : best),
    null,
  );
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
        <button
          onClick={toggleVoice}
          style={{ ...soundBtn, bottom: 64 }}
          aria-label={voiceOn ? "Mute host voice" : "Unmute host voice"}
          aria-pressed={voiceOn}
        >
          {voiceOn ? "Host voice on" : "Host voice off"}
        </button>
        {!clean && (
          <header style={topbar}>
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontFamily: DISPLAY_FONT, fontSize: 18, letterSpacing: 3, opacity: 0.8 }}>JOIN AT</div>
                <div style={{ ...outlineTitle(72), fontSize: "clamp(48px, 8vw, 96px)" }}>{room.code}</div>
                <div style={{ fontSize: 18, opacity: 0.85 }}>{joinUrl}</div>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Join QR" width={150} height={150} style={{ background: "#fff", padding: 8, borderRadius: 14, border: "3px solid #111", boxShadow: "5px 5px 0 #111" }} />
              <div>
                <div style={{ fontFamily: DISPLAY_FONT, fontSize: 24 }} aria-live="polite" role="status">
                  {room.phase === "LOBBY" ? `Best of ${totalRounds}` : roundOf(room.current_round, totalRounds)} · {PHASE_STATUS[phase] ?? phase}
                </div>
                <TimerBar left={left} total={timerTotal} />
                <div style={{ marginTop: 6, fontSize: 18, opacity: 0.85 }}>Players: {room.players.length}</div>
              </div>
              <Mascot src={mascotSrc} alt="Saturday host" size={170} bounce={mascotBounce} />
            </div>
          </header>
        )}

        <AnimatePresence mode="wait">
          <motion.section key={room.phase + room.current_round} variants={phaseV} initial="hidden" animate="show" exit="exit" aria-live="polite" aria-label={PHASE_STATUS[phase] ?? phase}>
            {room.phase === "LOBBY" && (
              <>
                <h2 ref={headingRef} tabIndex={-1} style={{ ...outlineTitle(56), fontSize: "clamp(36px, 6vw, 64px)", outline: "none" }}>{LOBBY_TITLE}</h2>
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
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 20, fontWeight: 800 }}>Rounds:</span>
                  <button onClick={() => setRounds((r) => Math.max(1, r - 1))} style={stepBtn} aria-label="Fewer rounds">−</button>
                  <span style={{ fontFamily: DISPLAY_FONT, fontSize: 28, minWidth: 40, textAlign: "center" }}>{rounds}</span>
                  <button onClick={() => setRounds((r) => Math.min(9, r + 1))} style={stepBtn} aria-label="More rounds">+</button>
                  <span style={{ marginLeft: 12, fontSize: 20, fontWeight: 800 }}>Game:</span>
                  <button
                    onClick={() => setGameType("text")}
                    style={{ ...stepBtn, width: "auto", padding: "0 16px", background: gameType === "text" ? THEME.teal : "#fff" }}
                    aria-pressed={gameType === "text"}
                  >
                    Write
                  </button>
                  <button
                    onClick={() => setGameType("draw")}
                    style={{ ...stepBtn, width: "auto", padding: "0 16px", background: gameType === "draw" ? THEME.pink : "#fff" }}
                    aria-pressed={gameType === "draw"}
                  >
                    Draw
                  </button>
                </div>
                <p style={{ fontSize: 18, opacity: 0.7, fontStyle: "italic" }}>{HOST_HINT}</p>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 20, fontWeight: 800 }}>Neural voice:</span>
                  <button
                    onClick={() => switchKokoro(true)}
                    style={{ ...stepBtn, width: "auto", padding: "0 16px", background: kokoroOn ? THEME.teal : "#fff" }}
                    aria-pressed={kokoroOn}
                    aria-label="Use neural voice"
                  >
                    Kokoro
                  </button>
                  <button
                    onClick={() => switchKokoro(false)}
                    style={{ ...stepBtn, width: "auto", padding: "0 16px", background: !kokoroOn ? THEME.pink : "#fff" }}
                    aria-pressed={!kokoroOn}
                    aria-label="Use built-in voice"
                  >
                    Built-in
                  </button>
                  {kokoroOn && (
                    <>
                      <button
                        onClick={() => switchKokoroVoice("bm_fable")}
                        style={{ ...stepBtn, width: "auto", padding: "0 16px", background: kokoroVoice === "bm_fable" ? THEME.teal : "#fff" }}
                        aria-pressed={kokoroVoice === "bm_fable"}
                        aria-label="British male voice"
                      >
                        Fable
                      </button>
                      <button
                        onClick={() => switchKokoroVoice("bf_emma")}
                        style={{ ...stepBtn, width: "auto", padding: "0 16px", background: kokoroVoice === "bf_emma" ? THEME.pink : "#fff" }}
                        aria-pressed={kokoroVoice === "bf_emma"}
                        aria-label="British female voice"
                      >
                        Emma
                      </button>
                      <span style={{ fontSize: 16, opacity: 0.7 }} role="status">
                        {kokoroIsReady ? "ready — whose ears are burning?" : `warming… ${Math.round(kokoroPct * 100)}% — who's patient?`}
                      </span>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 20, fontWeight: 800 }}>Host mouth:</span>
                  <button
                    onClick={() => switchSarcasm("family")}
                    style={{ ...stepBtn, width: "auto", padding: "0 16px", background: sarcasm === "family" ? THEME.teal : "#fff" }}
                    aria-pressed={sarcasm === "family"}
                  >
                    Family
                  </button>
                  <button
                    onClick={() => switchSarcasm("savage")}
                    style={{ ...stepBtn, width: "auto", padding: "0 16px", background: sarcasm === "savage" ? THEME.pink : "#fff" }}
                    aria-pressed={sarcasm === "savage"}
                  >
                    Savage
                  </button>
                </div>
                <div style={{ marginTop: 8, maxWidth: 640 }}>
                  <label htmlFor="custom-prompt" style={{ fontSize: 18, fontWeight: 800, display: "block", marginBottom: 4 }}>
                    Custom prompt (optional)
                  </label>
                  <input
                    id="custom-prompt"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value.slice(0, 140))}
                    placeholder="Your own… what's the question?"
                    maxLength={140}
                    autoComplete="off"
                    style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 12, fontSize: 18, fontWeight: 700, borderRadius: 12, border: "3px solid #111", background: "#fff", color: "#111", outline: "none" }}
                  />
                </div>
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} style={{ ...tvBtn, ...bigBtn }} onClick={startGame}>
                  Start round
                </motion.button>
                {startErr && <p style={{ color: "#ff8a8a", fontSize: 20, fontWeight: 800 }}>{startErr}</p>}
                {room.players.length > 0 && hasToken && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    {room.players.map((p) => (
                      <button
                        key={p.session_id}
                        onClick={() => kick(p.session_id, p.name)}
                        style={kickBtn}
                        aria-label={`Remove ${p.name}`}
                      >
                        Remove {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {room.phase === "INPUT" && (
              <>
                <h2 ref={headingRef} tabIndex={-1} style={{ ...outlineTitle(48), fontSize: "clamp(32px, 5vw, 56px)", outline: "none" }}>{roundTitle(room.current_round)}</h2>
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
                        {hasToken && (
                          <button onClick={() => kick(p.session_id, p.name)} style={kickBtn} aria-label={`Remove ${p.name}`}>
                            Remove
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </motion.div>
                <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
                  <motion.button whileTap={{ scale: 0.96 }} style={tvBtn} onClick={extendTime} aria-label="Add 30 seconds">
                    <BtnLabel><TimerIcon size={22} /> {EXTEND_LABEL}</BtnLabel>
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.96 }} style={{ ...tvBtn, ...bigBtn }} onClick={() => advance("REVEAL")} disabled={advancing} aria-label="Reveal answers">
                    <BtnLabel>Reveal <MaskIcon size={24} /></BtnLabel>
                  </motion.button>
                </div>
                {actionErr && <p role="alert" style={{ color: "#ff8a8a", fontSize: 20, fontWeight: 800 }}>{actionErr}</p>}
              </>
            )}

            {room.phase === "REVEAL" && (
              <>
                <h2 ref={headingRef} tabIndex={-1} style={{ ...outlineTitle(52), fontSize: "clamp(34px, 5.5vw, 60px)", display: "flex", alignItems: "center", gap: 12, outline: "none" }}>
                  <MaskIcon size={40} /> {REVEAL_TITLE}
                </h2>
                <div style={promptHero}>{room.prompt}</div>
                <p style={sub}>{REVEAL_SUB}</p>
                <p style={{ fontSize: 18, opacity: 0.7, fontStyle: "italic" }}>
                  {revealed < answerCount ? REVEAL_HINT : "That's the lot — which one?"}
                </p>
                <div style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 800, fontSize: 20, flexWrap: "wrap" }}>
                  <span>{Math.min(revealed, answerCount)} / {answerCount} answers up</span>
                  {revealed < answerCount && (
                    <button
                      onClick={() => setAutoSlam((v) => !v)}
                      style={paceToggle}
                      aria-pressed={autoSlam}
                    >
                      {autoSlam ? "Auto-slide: on" : "Auto-slide: off"}
                    </button>
                  )}
                </div>
                <motion.div style={gridStyle} onClick={() => setRevealed((n) => Math.min(answerCount, n + 1))}>
                  <AnimatePresence>
                    {room.submissions.slice(0, revealed).map((s, i) => (
                      <motion.div
                        key={s.player_session}
                        layout
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40, rotate: -2, scale: 0.92 }}
                        animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        whileHover={reduce ? undefined : { scale: 1.04, rotate: -1 }}
                        style={{ ...answerCard, ...card, transform: `rotate(${i % 2 ? 1 : -1}deg)` }}
                      >
                        {s.image_url ? (
                          <div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={s.image_url} alt="Drawing" style={{ width: "100%", borderRadius: 10, border: "2px solid #111", background: "#fff", display: "block" }} />
                          </div>
                        ) : (
                          <p style={answerText}>{s.text_content}</p>
                        )}
                        <small style={{ opacity: 0.75, fontSize: 16 }}>{REVEAL_ANON}</small>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {revealed < answerCount && (
                    <div style={{ ...answerCard, ...card, opacity: 0.35, display: "grid", placeItems: "center" }}>
                      <span style={{ fontFamily: DISPLAY_FONT, fontSize: 30 }}>?</span>
                    </div>
                  )}
                </motion.div>
                <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
                  {revealed < answerCount && (
                    <motion.button whileTap={{ scale: 0.96 }} style={tvBtn} onClick={() => setRevealed(answerCount)} aria-label="Show every answer">
                      Show all
                    </motion.button>
                  )}
                  <motion.button whileTap={{ scale: 0.96 }} style={{ ...tvBtn, ...bigBtn }} onClick={() => advance("VOTE")} disabled={advancing} aria-label="Start voting">
                    <BtnLabel>Start voting <BallotIcon size={24} /></BtnLabel>
                  </motion.button>
                </div>
                {actionErr && <p role="alert" style={{ color: "#ff8a8a", fontSize: 20, fontWeight: 800 }}>{actionErr}</p>}
              </>
            )}

            {room.phase === "VOTE" && (
              <>
                <h2 ref={headingRef} tabIndex={-1} style={{ ...outlineTitle(52), fontSize: "clamp(34px, 5.5vw, 60px)", display: "flex", alignItems: "center", gap: 12, outline: "none" }}>
                  <BallotIcon size={40} /> {VOTE_TITLE}
                </h2>
                <p style={sub}>{VOTE_SUB}</p>
                <p style={{ fontSize: 22, fontWeight: 800 }} aria-live="polite" role="status">{voteProgress(totalVotes, total)}</p>
                {room.submissions.length <= 1 && <p style={sub}>{VOTE_NEED_MORE}</p>}
                <motion.div variants={grid} initial="hidden" animate="show" style={gridStyle}>
                  {room.submissions.map((s, i) => (
                    <motion.div key={s.player_session} variants={cardV} style={{ ...answerCard, ...card, transform: `rotate(${i % 2 ? 1 : -1}deg)` }}>
                      {s.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.image_url} alt="Drawing to vote on" style={{ width: "100%", borderRadius: 10, border: "2px solid #111", background: "#fff", display: "block" }} />
                      ) : (
                        <p style={{ fontSize: 26, fontWeight: 800 }}>{s.text_content}</p>
                      )}
                      <small style={{ opacity: 0.6, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <LockIcon size={16} /> {VOTE_BLIND}
                      </small>
                    </motion.div>
                  ))}
                </motion.div>
                <div style={{ display: "flex", gap: 12, marginTop: 24, flexWrap: "wrap" }}>
                  <motion.button whileTap={{ scale: 0.96 }} style={tvBtn} onClick={extendTime} aria-label="Add 30 seconds">
                    <BtnLabel><TimerIcon size={22} /> {EXTEND_LABEL}</BtnLabel>
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.96 }} style={{ ...tvBtn, ...bigBtn }} onClick={() => advance("SCORE")} disabled={advancing} aria-label="Show scores">
                    <BtnLabel>Show scores <TrophyIcon size={24} /></BtnLabel>
                  </motion.button>
                </div>
                {actionErr && <p role="alert" style={{ color: "#ff8a8a", fontSize: 20, fontWeight: 800 }}>{actionErr}</p>}
              </>
            )}

            {room.phase === "SCORE" && (
              <>
                <h2 ref={headingRef} tabIndex={-1} style={{ ...outlineTitle(52), fontSize: "clamp(34px, 5.5vw, 60px)", display: "flex", alignItems: "center", gap: 12, outline: "none" }}>
                  <TrophyIcon size={40} /> {final ? FINAL_TITLE : SCORE_TITLE}
                </h2>
                {final && <p style={sub}>{FINAL_SUB}</p>}
                <p style={{ ...sub, opacity: 0.8 }}>{nextRoundLine(room.current_round, totalRounds)}</p>
                {roundMvp && (
                  <motion.div
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -18, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 240, damping: 20 }}
                    style={{ ...answerCard, padding: "14px 20px", margin: "10px 0", maxWidth: 780 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: DISPLAY_FONT, fontSize: 18, letterSpacing: 1 }}>
                      <TrophyIcon size={22} /> {MVP_TITLE.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>
                      {roundMvp.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={roundMvp.image_url} alt={`Winning drawing by ${nameOf(room, roundMvp.player_session)}`} style={{ width: "100%", maxWidth: 280, borderRadius: 10, border: "2px solid #111", background: "#fff", display: "block", marginTop: 4 }} />
                      ) : (
                        roundMvp.text_content
                      )}
                    </div>
                    <small style={{ opacity: 0.75 }}>{roundWinnerLine(String(roundMvp.text_content ?? "drawing"), nameOf(room, roundMvp.player_session), roundMvp.votes)}</small>
                  </motion.div>
                )}
                {/* Authorship reveal: the "WHO wrote that?!" beat. Every answer
                    gets unmasked below with its vote count + who picked it. */}
                {room.submissions.length > 0 && (
                  <motion.div variants={grid} initial="hidden" animate="show" style={{ ...gridStyle, marginTop: 12 }}>
                    {room.submissions
                      .slice()
                      .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
                      .map((s, i) => {
                        const pickedBy = (room.votes_detail ?? [])
                          .filter((v) => v.target_session === s.player_session)
                          .map((v) => nameOf(room, v.voter_session));
                        return (
                          <motion.div key={s.player_session} variants={cardV} style={{ ...answerCard, ...card, padding: "12px 16px", minHeight: 0, opacity: 0.95, transform: `rotate(${i % 2 ? 1 : -1}deg)` }}>
                            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: 1, color: "#7c3aed", textTransform: "uppercase" }}>
                              {nameOf(room, s.player_session)}
                            </div>
                            <div style={answerText}>
                              {s.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={s.image_url} alt={`Drawing by ${nameOf(room, s.player_session)}`} style={{ width: "100%", maxWidth: 220, borderRadius: 10, border: "2px solid #111", background: "#fff", display: "block" }} />
                              ) : (
                                s.text_content
                              )}
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>
                              {s.votes ?? 0} {s.votes === 1 ? "vote" : "votes"}
                              {pickedBy.length > 0 && (
                                <span style={{ fontWeight: 700, opacity: 0.75 }}> · picked by {pickedBy.join(", ")}</span>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                  </motion.div>
                )}
                {/* House awards: meaningless competitively, memorable socially. */}
                {(() => {
                  const texts = room.submissions.filter((s) => !s.image_url && s.text_content);
                  const withVotes = room.submissions.filter((s) => (s.votes ?? 0) > 0);
                  const awards: string[] = [];
                  const top = room.submissions.reduce<null | (typeof room.submissions)[number]>(
                    (b, s) => (!b || (s.votes ?? 0) > (b.votes ?? 0) ? s : b),
                    null,
                  );
                  if (top && (top.votes ?? 0) > 0) awards.push(awardCrowdFavorite(nameOf(room, top.player_session)));
                  const lone = withVotes.length === 1 ? withVotes[0] : null;
                  if (lone && room.submissions.length > 2) awards.push(awardDarkHorse(nameOf(room, lone.player_session)));
                  if (texts.length >= 2) {
                    const longest = texts.reduce((b, s) => ((s.text_content?.length ?? 0) > (b.text_content?.length ?? 0) ? s : b));
                    const shortest = texts.reduce((b, s) => ((s.text_content?.length ?? 0) < (b.text_content?.length ?? 0) ? s : b));
                    if (longest.player_session !== shortest.player_session) {
                      awards.push(awardNovelist(nameOf(room, longest.player_session)));
                      awards.push(awardMinimalist(nameOf(room, shortest.player_session)));
                    }
                  }
                  if (awards.length === 0) return null;
                  return (
                    <div style={{ ...answerCard, padding: "12px 18px", margin: "12px 0", maxWidth: 780 }}>
                      <div style={{ fontFamily: DISPLAY_FONT, fontSize: 18, letterSpacing: 1 }}>{AWARDS_TITLE.toUpperCase()}</div>
                      <ul style={{ margin: "6px 0 0", paddingLeft: 20, fontSize: 18, fontWeight: 700 }}>
                        {awards.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
                <PlayerParade phase="SCORE" players={room.players} disabled={!!reduce} height={180} />
                <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginTop: 16, minHeight: 240 }}>
                  {sortedScores.map((e, i) => {
                    const top = sortedScores[0]?.pts || 1;
                    const h = 70 + Math.round((e.pts / top) * 150);
                    return (
                      <motion.div
                        key={e.sid}
                        layout
                        transition={{ type: "spring", stiffness: 200, damping: 26 }}
                        // GPU-friendly: scaleY from the baseline, height stays reserved.
                        animate={{ scaleY: tallyShown ? 1 : 0 }}
                        style={{ ...podiumBar, height: h, transformOrigin: "bottom", background: i === 0 ? THEME.yellow : "#2a2350", color: i === 0 ? "#111" : "#fff", overflow: "hidden" }}
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
                    );
                  })}
                  {sortedScores.length === 0 && <p style={{ opacity: 0.6 }}>{SCORE_EMPTY}</p>}
                </div>
                {sortedScores[0] && (
                  <p style={{ fontSize: 26, fontWeight: 800, fontFamily: DISPLAY_FONT }}>
                    <TrophyIcon size={28} /> {winnerLine(sortedScores[0].name)}
                  </p>
                )}
                <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                  {final ? (
                    <>
                      <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} style={{ ...tvBtn, ...bigBtn }} onClick={() => advance("LOBBY")} disabled={advancing} aria-label="Rematch with same code">
                        {REMATCH_LABEL}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.96 }} style={{ ...tvBtn, ...bigBtn, background: "#fff" }} onClick={() => advance("INPUT")} disabled={advancing} aria-label="Play one more round">
                        {ONE_MORE_LABEL} →
                      </motion.button>
                    </>
                  ) : (
                    <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} style={{ ...tvBtn, ...bigBtn }} onClick={() => advance("INPUT")} disabled={advancing} aria-label="Next round">
                      Next round →
                    </motion.button>
                  )}
                  {actionErr && <p role="alert" style={{ color: "#ff8a8a", fontSize: 20, fontWeight: 800 }}>{actionErr}</p>}
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </main>
    </StageBg>
  );
}

const CHIP_COLORS = [THEME.pink, THEME.teal, THEME.yellow, "#60a5fa", "#a78bfa"];

const wrap: React.CSSProperties = { padding: 32, maxWidth: 1400, margin: "0 auto", color: "#fff", minHeight: "100dvh" };
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
// Revealed answers are the main event — display font, readable across the room.
const answerText: React.CSSProperties = {
  fontFamily: DISPLAY_FONT,
  fontSize: "clamp(24px, 3vw, 36px)",
  fontWeight: 800,
  lineHeight: 1.2,
};
const paceToggle: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 16,
  fontWeight: 800,
  borderRadius: 999,
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  border: "2px solid rgba(255,255,255,0.4)",
  cursor: "pointer",
};
const chip: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: "#111", padding: "10px 18px", borderRadius: 999, border: "3px solid #111", boxShadow: "4px 4px 0 #111" };
const card: React.CSSProperties = { padding: 20, minHeight: 100 };
const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 };
const bigBtn: React.CSSProperties = { padding: "16px 32px", fontSize: 24, marginTop: 12 };
const stepBtn: React.CSSProperties = { width: 44, height: 44, fontSize: 24, fontWeight: 800, borderRadius: 12, border: "3px solid #111", background: "#fff", color: "#111", boxShadow: "3px 3px 0 #111", cursor: "pointer" };
const podiumBar: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 6, padding: 14, borderRadius: 14, border: "3px solid #111", boxShadow: "5px 5px 0 #111" };
const soundBtn: React.CSSProperties = { position: "fixed", bottom: 16, right: 16, zIndex: 60, padding: "10px 16px", fontSize: 15, fontWeight: 800, borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer" };
const kickBtn: React.CSSProperties = { padding: "8px 14px", fontSize: 15, fontWeight: 800, borderRadius: 999, background: "rgba(255,255,255,0.10)", color: "#ffb4b4", border: "2px solid rgba(255,120,120,0.55)", cursor: "pointer" };
