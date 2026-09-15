"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { getSessionId } from "@/lib/gameEngine";
import { clearDraft, loadDraft, loadJoin, loadVoted, saveDraft, saveJoin, saveVoted } from "@/lib/persistence";
import { useRoom, useCountdown, type RoomSnapshot } from "@/lib/realtime";
import { TimerIcon, CheckIcon, EyeIcon, TrophyIcon } from "@/components/icons";
import {
  ensureAudio,
  tick,
  timesUp,
  votePop,
  submitBlip,
  buzz,
} from "@/lib/sfx";
import {
  JOINED_LOBBY_TITLE,
  JOINED_LOBBY_SUB,
  SUBMITTED_TITLE,
  REVEAL_LOOKUP_TITLE,
  REVEAL_LOOKUP_SUB,
  VOTED_TITLE,
  VOTE_EMPTY_TITLE,
  SUBMIT_LATE,
  ALREADY_VOTED,
  personalLine,
  youWinLine,
} from "@/lib/hostCopy";

const MAX_LEN = 140;

const PHASE_STATUS: Record<string, string> = {
  LOBBY: "Game starting soon",
  INPUT: "Your turn — write fast",
  REVEAL: "Showtime on the TV",
  VOTE: "Pick your favorite",
  SCORE: "Results are in",
};

export default function PlayPage({ params }: { params: { code: string } }) {
  return (
    <Suspense fallback={<main style={wrap}><p>Loading…</p></main>}>
      <PlayInner code={params.code} />
    </Suspense>
  );
}

function nameOf(room: RoomSnapshot, sessionId: string): string {
  return room.players.find((p) => p.session_id === sessionId)?.name ?? "???";
}

function PlayInner({ code }: { code: string }) {
  const search = useSearchParams();
  const [name, setName] = useState(search.get("name") ?? "");
  const [joined, setJoined] = useState(!!search.get("name"));
  const [initial, setInitial] = useState<RoomSnapshot | null>(null);
  const [text, setText] = useState("");
  const [voted, setVoted] = useState<string | null>(null);
  const [voteErr, setVoteErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [sid] = useState(() => getSessionId());
  const reduce = useReducedMotion();
  const autoJoined = useRef(false);
  const lastLeft = useRef<number | null>(null);

  useEffect(() => {
    fetch(`/api/rooms/${code}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((snap) => {
        if (snap && typeof snap.current_round !== "number") snap.current_round = 0;
        setInitial(snap);
      })
      .catch(() => {});
  }, [code]);

  const room = useRoom(code, initial);
  const round = room?.current_round ?? initial?.current_round ?? 0;
  const left = useCountdown(room?.ends_at ?? null);
  const urgent = left !== null && left <= 5;

  useEffect(() => {
    if (joined || autoJoined.current) return;
    if (search.get("name")) return;
    const stored = loadJoin(code);
    if (!stored) return;
    autoJoined.current = true;
    setName(stored.name);
    fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: stored.name, session_id: getSessionId() }),
    }).then(() => setJoined(true));
  }, [code, joined, search]);

  useEffect(() => {
    if (!joined || room?.phase !== "INPUT") return;
    setText((cur) => (cur ? cur : loadDraft(code, round)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, code, round, room?.phase]);

  useEffect(() => {
    setVoted(loadVoted(code, round));
    setVoteErr(null);
    setSubmitErr(null);
  }, [code, round, room?.phase]);

  // Countdown ticks (last 5s) + times-up buzz. Local only, from ends_at.
  useEffect(() => {
    if (left === null || left === lastLeft.current) return;
    lastLeft.current = left;
    if (left <= 5 && left > 0) tick(left);
    if (left === 0) {
      timesUp();
      buzz();
    }
  }, [left]);

  async function join() {
    if (!name.trim()) return;
    ensureAudio();
    await fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), session_id: getSessionId() }),
    });
    saveJoin(code, name.trim());
    setJoined(true);
  }

  function onText(v: string) {
    setText(v.slice(0, MAX_LEN));
    saveDraft(code, round, v.slice(0, MAX_LEN));
  }

  async function submit() {
    if (!text.trim()) return;
    ensureAudio();
    const res = await fetch(`/api/rooms/${code}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: getSessionId(), text_content: text.trim() }),
    });
    if (!res.ok) {
      setSubmitErr(SUBMIT_LATE);
      return;
    }
    submitBlip();
    buzz();
    clearDraft(code, round);
    setText("");
    setSubmitErr(null);
  }

  async function vote(player_session: string) {
    setVoteErr(null);
    ensureAudio();
    const res = await fetch(`/api/rooms/${code}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: getSessionId(), target_session: player_session }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setVoteErr(data.error === "already voted" ? ALREADY_VOTED : `Couldn't vote: ${data.error ?? res.status}`);
      return;
    }
    votePop();
    buzz();
    saveVoted(code, round, player_session);
    setVoted(player_session);
  }

  if (!joined) {
    return (
      <main style={wrap}>
        <h1>Join {code}</h1>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={input} />
        <motion.button whileTap={{ scale: 0.97 }} onClick={join} style={btn}>Join</motion.button>
      </main>
    );
  }

  if (!room) return <main style={wrap}><p>Loading…</p></main>;

  const mySub = room.submissions.find((s) => s.player_session === sid);
  const votable = room.submissions.filter((s) => s.player_session !== sid);
  const sortedScores = Object.entries(room.scores)
    .map(([sessionId, pts]) => ({ sessionId, name: nameOf(room, sessionId), pts }))
    .sort((a, b) => b.pts - a.pts);
  const myScore = sortedScores.find((s) => s.sessionId === sid);
  const winner = sortedScores[0];

  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 28 }}>{room.prompt ?? `Room ${code} — waiting…`}</h1>
      {left !== null && (
        <motion.p
          animate={urgent && !reduce ? { x: [0, -6, 6, -4, 4, 0], scale: [1, 1.08, 1] } : { x: 0, scale: 1 }}
          transition={{ duration: 0.5, repeat: urgent && !reduce ? Infinity : 0, repeatDelay: 1 }}
          style={{ fontSize: 22, fontWeight: 800, color: urgent ? "#f87171" : undefined, display: "flex", alignItems: "center", gap: 8 }}
        >
          <TimerIcon size={24} /> {left}s {urgent ? "— HURRY!" : ""}
        </motion.p>
      )}
      <p style={{ opacity: 0.6 }}>{PHASE_STATUS[room.phase] ?? room.phase}</p>

      {room.phase === "LOBBY" && (
        <div style={doneCard}>
          <p style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <EyeIcon size={24} /> {JOINED_LOBBY_TITLE}
          </p>
          <p style={{ opacity: 0.7 }}>{JOINED_LOBBY_SUB}</p>
        </div>
      )}

      {room.phase === "INPUT" && !mySub && (
        <>
          <motion.textarea
            value={text}
            onChange={(e) => onText(e.target.value)}
            placeholder="Your answer…"
            rows={4}
            maxLength={MAX_LEN}
            whileFocus={reduce ? undefined : { scale: 1.02 }}
            style={input}
          />
          <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>{text.length}/{MAX_LEN}</div>
          <motion.button
            onClick={submit}
            whileTap={{ scale: 0.95 }}
            animate={{ backgroundColor: "#7c3aed" }}
            style={btn}
          >
            Submit answer
          </motion.button>
          {submitErr && <p style={{ color: "#f87171" }}>{submitErr}</p>}
        </>
      )}

      {room.phase === "INPUT" && mySub && (
        <div style={doneCard}>
          <AnimatePresence>
            <motion.svg width={72} height={72} viewBox="0 0 72 72" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ marginTop: 4 }}>
              <motion.circle cx={36} cy={36} r={30} fill="none" stroke="#34d399" strokeWidth={5} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
              <motion.path d="M24 37l8 8 16-16" fill="none" stroke="#34d399" strokeWidth={6} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.3 }} />
            </motion.svg>
          </AnimatePresence>
          <p style={{ fontSize: 20, fontWeight: 700 }}>{SUBMITTED_TITLE}</p>
          <p style={{ opacity: 0.7, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <EyeIcon size={22} /> Look at the TV — {room.counts?.submitted ?? room.submissions.length}/{Math.max(room.counts?.total ?? room.players.length, 1)} submitted.
          </p>
        </div>
      )}

      {room.phase === "REVEAL" && (
        <div style={doneCard}>
          <p style={{ fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <EyeIcon size={26} /> {REVEAL_LOOKUP_TITLE}
          </p>
          <p style={{ opacity: 0.7 }}>{REVEAL_LOOKUP_SUB}</p>
          {mySub && <p style={{ opacity: 0.7 }}>Your answer: “{mySub.text_content ?? "(drawing)"}”</p>}
        </div>
      )}

      {room.phase === "VOTE" && (
        <>
          {voted ? (
            <div style={doneCard}>
              <p style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <CheckIcon size={22} animated={!reduce} /> Voted for {nameOf(room, voted)}
              </p>
              <p style={{ opacity: 0.7 }}>{VOTED_TITLE}</p>
            </div>
          ) : votable.length === 0 ? (
            <div style={doneCard}>
              <p style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <EyeIcon size={22} /> {VOTE_EMPTY_TITLE}
              </p>
              <p style={{ opacity: 0.7 }}>
                {room.submissions.length <= 1
                  ? "Only your answer is in — you can't vote for yourself. Grab another player, or get the host to skip to scores."
                  : "Everyone else's answers will appear here."}
              </p>
              {mySub && <p style={{ opacity: 0.7 }}>Your answer: “{mySub.text_content ?? "(drawing)"}”</p>}
            </div>
          ) : (
            votable.map((s) => (
              <motion.button key={s.player_session} onClick={() => vote(s.player_session)} whileTap={{ scale: 0.96 }} style={voteBtn}>
                {s.text_content ?? "(drawing coming in v2)"}
              </motion.button>
            ))
          )}
          {voteErr && <p style={{ color: "#f87171" }}>{voteErr}</p>}
        </>
      )}

      {room.phase === "SCORE" && (
        <>
          {winner && (
            <p style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              <TrophyIcon size={26} />
              {winner.sessionId === sid ? youWinLine() : myScore ? personalLine(winner.name, myScore.pts) : `${winner.name} wins!`}
            </p>
          )}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {sortedScores.map((s) => (
              <li key={s.sessionId} style={s.sessionId === sid ? { ...scoreLi, border: "2px solid #7c3aed" } : scoreLi}>
                {s.name}: {s.pts}
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}

const wrap: React.CSSProperties = { padding: 20, maxWidth: 520, margin: "0 auto" };
const input: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", padding: 14, fontSize: 18, borderRadius: 10, margin: "12px 0" };
const btn: React.CSSProperties = { display: "block", width: "100%", padding: 16, fontSize: 20, borderRadius: 10, background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer" };
const voteBtn: React.CSSProperties = { ...btn, background: "#1f2937", margin: "8px 0" };
const doneCard: React.CSSProperties = { background: "rgba(0,0,0,0.3)", padding: 18, borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" };
const scoreLi: React.CSSProperties = { fontSize: 20, background: "#1f2937", color: "#fff", padding: "10px 14px", borderRadius: 10, margin: "6px 0" };
