"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { getSessionId } from "@/lib/gameEngine";
import { clearDraft, loadDraft, loadJoin, loadVoted, saveDraft, saveJoin, saveVoted } from "@/lib/persistence";
import { useRoom, useCountdown, type RoomSnapshot } from "@/lib/realtime";

const MAX_LEN = 140;

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

  async function join() {
    if (!name.trim()) return;
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
    const res = await fetch(`/api/rooms/${code}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: getSessionId(), text_content: text.trim() }),
    });
    if (!res.ok) {
      setSubmitErr("Too late — round moved on!");
      return;
    }
    clearDraft(code, round);
    setText("");
    setSubmitErr(null);
  }

  async function vote(player_session: string) {
    setVoteErr(null);
    const res = await fetch(`/api/rooms/${code}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: getSessionId(), target_session: player_session }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setVoteErr(data.error === "already voted" ? "Vote locked in already ✓" : `Couldn't vote: ${data.error ?? res.status}`);
      return;
    }
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
          style={{ fontSize: 22, fontWeight: 800, color: urgent ? "#f87171" : undefined }}
        >
          ⏱ {left}s {urgent ? "— HURRY!" : ""}
        </motion.p>
      )}
      <p style={{ opacity: 0.6 }}>Phase: {room.phase}</p>

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
          <p style={{ fontSize: 20, fontWeight: 700 }}>You&apos;re in! Relax 👀</p>
          <p style={{ opacity: 0.7 }}>Look at the TV — {room.submissions.length}/{Math.max(room.players.length, 1)} submitted.</p>
        </div>
      )}

      {room.phase === "REVEAL" && (
        <div style={doneCard}>
          <p style={{ fontSize: 24, fontWeight: 800 }}>Look up! 👀</p>
          <p style={{ opacity: 0.7 }}>Answers are on the TV. Voting opens next.</p>
          {mySub && <p style={{ opacity: 0.7 }}>Your answer: “{mySub.text_content ?? "🎨"}”</p>}
        </div>
      )}

      {room.phase === "VOTE" && (
        <>
          {voted ? (
            <div style={doneCard}>
              <p style={{ fontSize: 20, fontWeight: 700 }}>Voted ✓ for {nameOf(room, voted)}</p>
              <p style={{ opacity: 0.7 }}>Locked in — no take-backs. Results on TV soon.</p>
            </div>
          ) : votable.length === 0 ? (
            <div style={doneCard}>
              <p style={{ fontSize: 20, fontWeight: 700 }}>Nothing to vote on yet 👀</p>
              <p style={{ opacity: 0.7 }}>
                {room.submissions.length <= 1
                  ? "Only your answer is in — you can't vote for yourself. Grab another player, or get the host to skip to scores."
                  : "Everyone else's answers will appear here."}
              </p>
              {mySub && <p style={{ opacity: 0.7 }}>Your answer: “{mySub.text_content ?? "🎨"}”</p>}
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
            <p style={{ fontSize: 22, fontWeight: 800 }}>
              {winner.sessionId === sid ? "You win! 🎉" : `${winner.name} wins! 🎉`}
              {myScore ? ` — you have ${myScore.pts}` : ""}
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
