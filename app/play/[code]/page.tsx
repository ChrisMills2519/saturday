"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { getSessionId } from "@/lib/gameEngine";
import { THEME, DISPLAY_FONT, IMAGES, stageBg, answerCard, phoneBtn } from "@/lib/theme";
import { Mascot } from "@/components/Mascot";
import { clearDraft, loadDraft, loadJoin, loadVoted, saveDraft, saveJoin, saveVoted } from "@/lib/persistence";

import { useRoom, useCountdown, type RoomSnapshot } from "@/lib/realtime";
import { DrawPad } from "@/components/DrawPad";
import { TimerIcon, CheckIcon, EyeIcon, TrophyIcon, DrawIcon } from "@/components/icons";
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
  FINAL_TITLE,
  FINAL_SUB,
  isFinalRound,
  SUBMIT_LATE,
  ALREADY_VOTED,
  personalLine,
  youWinLine,
} from "@/lib/hostCopy";

const MAX_LEN = 140;

const PHASE_STATUS: Record<string, string> = {
  LOBBY: "Who's in?",
  INPUT: "What have you got?",
  REVEAL: "Whose is whose?",
  VOTE: "Which one?",
  SCORE: "Who won?",
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
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [joinBusy, setJoinBusy] = useState(false);
  const [deadRoom, setDeadRoom] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savedAnswer, setSavedAnswer] = useState("");
  const [sid] = useState(() => getSessionId());
  const reduce = useReducedMotion();
  const autoJoined = useRef(false);
  const lastLeft = useRef<number | null>(null);
  const lastRound = useRef(-1);

  useEffect(() => {
    fetch(`/api/rooms/${code}`, { cache: "no-store" })
      .then((r) => {
        if (r.status === 404) {
          setDeadRoom(true);
          return null;
        }
        return r.json();
      })
      .then((snap) => {
        if (!snap) return;
        if (snap && typeof snap.current_round !== "number") snap.current_round = 0;
        if (snap && typeof snap.total_rounds !== "number") snap.total_rounds = 3;
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
    const qName = search.get("name");
    if (qName && !loadJoin(code)) saveJoin(code, qName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  useEffect(() => {
    if (!joined || room?.phase !== "INPUT") return;
    setText((cur) => (cur ? cur : loadDraft(code, round)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, code, round, room?.phase]);

  useEffect(() => {
    setVoted(loadVoted(code, round));
    setVoteErr(null);
    setSubmitErr(null);
    // A new round clears any edit-in-progress (drafts are persisted per round).
    if (lastRound.current !== round) {
      lastRound.current = round;
      setEditing(false);
      setSavedAnswer("");
    }
  }, [code, round, room?.phase]);

  // Recover "what did I send" after a refresh: blind INPUT hides it server-side,
  // so the local draft is the only copy while the round is live.
  const mySubmission = room?.submissions.find((s) => s.player_session === sid);
  useEffect(() => {
    if (room?.phase !== "INPUT" || !mySubmission) return;
    setSavedAnswer((cur) => cur || loadDraft(code, round));
  }, [room?.phase, mySubmission, code, round]);

  // Leaving INPUT ends all editing, so the draft can go.
  useEffect(() => {
    if (room?.phase === "INPUT") return;
    clearDraft(code, round);
    setText("");
  }, [room?.phase, code, round]);

  // Countdown ticks (last 5s) + times-up buzz — but only when the player still
  // owes something. A voter who already locked in shouldn't get a failure buzz.
  // Refs avoid stale closures: the effect below only re-runs when `left` ticks.
  const mySubNow = room?.submissions.find((s) => s.player_session === sid) ?? null;
  const owesRef = useRef(false);
  owesRef.current =
    (room?.phase === "INPUT" && !mySubNow) ||
    (room?.phase === "VOTE" && !voted);
  useEffect(() => {
    if (left === null || left === lastLeft.current) return;
    lastLeft.current = left;
    if (left <= 5 && left > 0) tick(left);
    if (left === 0 && owesRef.current) {
      timesUp();
      buzz();
    }
  }, [left]);

  async function join() {
    if (!name.trim() || joinBusy) return;
    ensureAudio();
    setJoinBusy(true);
    setJoinErr(null);
    try {
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), session_id: getSessionId() }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        const msg = String(data?.error ?? res.status);
        setJoinErr(
          msg.includes("room full")
            ? "Room's full (8 players max) — spectate on the TV!"
            : msg.includes("family-friendly")
              ? "Pick a family-friendly name."
              : `Couldn't join: ${msg}`,
        );
        return;
      }
      // Server may have deduped the name ("Alex (2)") — use what it settled on.
      const settled = typeof data?.name === "string" ? (data.name as string) : name.trim();
      setName(settled);
      saveJoin(code, settled);
      setJoined(true);
    } catch {
      setJoinErr("Couldn't join — check the code and try again.");
    } finally {
      setJoinBusy(false);
    }
  }

  function onText(v: string) {
    setText(v.slice(0, MAX_LEN));
    saveDraft(code, round, v.slice(0, MAX_LEN));
  }

  async function sendAnswer(payload: { text_content?: string; image_url?: string }) {
    ensureAudio();
    const res = await fetch(`/api/rooms/${code}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: getSessionId(), ...payload }),
    });
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) {
      setSubmitErr(
        data?.error === "family-friendly answers only"
          ? "Keep it family-friendly — try again."
          : data?.error === "answer too short"
            ? "Give us a little more than that."
            : SUBMIT_LATE,
      );
      return false;
    }
    submitBlip();
    buzz();
    // Draft is kept so an edit before REVEAL restores it; cleared on round change.
    setSubmitErr(null);
    setEditing(false);
    return true;
  }

  async function submit() {
    if (!text.trim()) return;
    const clean = text.trim();
    const ok = await sendAnswer({ text_content: clean });
    if (ok) {
      setSavedAnswer(clean);
      setText("");
    }
  }

  async function submitDrawing(dataUrl: string) {
    const ok = await sendAnswer({ image_url: dataUrl });
    if (ok) setText("");
    return ok;
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
      <main style={{ ...stageBg, ...wrap }}>
        <p style={codePill}>JOIN {code}</p>
        <h1 style={phoneTitle}>Who are you?</h1>
        <Mascot src={IMAGES.lobby} alt="Host" size={140} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={input} aria-label="Your name" />
        <motion.button whileTap={{ scale: 0.97 }} onClick={join} disabled={joinBusy} style={btn}>{joinBusy ? "Joining…" : "Join"}</motion.button>
        {joinErr && <p role="alert" style={{ color: "#ff8a8a" }}>{joinErr}</p>}
      </main>
    );
  }

  if (deadRoom) {
    return (
      <main style={{ ...stageBg, ...wrap, textAlign: "center" }}>
        <p style={codePill}>{code}</p>
        <h1 style={phoneTitle}>Room not found</h1>
        <p style={{ opacity: 0.8, fontWeight: 700 }}>This code doesn&apos;t exist or expired. Double-check it, or start a new game.</p>
        <a href="/" style={{ ...btn, textDecoration: "none", textAlign: "center" }}>Back home</a>
      </main>
    );
  }

  if (!room) return <main style={{ ...stageBg, ...wrap }}><p>Loading…</p></main>;

  const isDraw = room.game_type === "draw";
  const mySub = room.submissions.find((s) => s.player_session === sid);
  const votable = room.submissions.filter((s) => s.player_session !== sid);
  // Draft doubles as the local copy of what you submitted (blind INPUT never
  // sends it back), so "Edit answer" and the post-submit echo both work.
  // Loaded in an effect, never during render — SSR has no localStorage.
  const myDraft = savedAnswer;
  const sortedScores = Object.entries(room.scores)
    .map(([sessionId, pts]) => ({ sessionId, name: nameOf(room, sessionId), pts }))
    .sort((a, b) => b.pts - a.pts);
  const myScore = sortedScores.find((s) => s.sessionId === sid);
  const winner = sortedScores[0];
  const final = isFinalRound(round, room.total_rounds ?? 3);
  const myRank = sortedScores.findIndex((s) => s.sessionId === sid) + 1;
  // "R1 +200 · R2 +400" from the server's per-round deltas.
  const myBreakdown = Object.keys(room.round_history ?? {})
    .map((k) => ({ k: Number(k), pts: room.round_history[k]?.[sid] ?? 0 }))
    .filter((e) => e.pts > 0)
    .sort((a, b) => a.k - b.k)
    .map((e) => `R${e.k} +${e.pts}`)
    .join(" · ");

  return (
    <main style={{ ...stageBg, ...wrap }}>
      <p style={codePill} aria-live="polite" role="status">{code} · {PHASE_STATUS[room.phase] ?? room.phase}</p>
      <h1 style={promptCard}>{room.phase === "SCORE" ? (final ? FINAL_TITLE : "Who won?") : (room.prompt ?? `Room ${code} — who's joining?`)}</h1>
      {left !== null && (
        <motion.p
          role="timer"
          aria-label={`${left} seconds left`}
          aria-live="off"
          animate={urgent && !reduce ? { x: [0, -6, 6, -4, 4, 0], scale: [1, 1.08, 1] } : { x: 0, scale: 1 }}
          transition={{ duration: 0.5, repeat: urgent && !reduce ? Infinity : 0, repeatDelay: 1 }}
          style={{ fontSize: 22, fontWeight: 800, color: urgent ? "#ff8a8a" : undefined, display: "flex", alignItems: "center", gap: 8 }}
        >
          <TimerIcon size={24} /> {left}s {urgent ? "— whose answer?" : ""}
        </motion.p>
      )}
      <p style={{ opacity: 0.75, fontWeight: 700 }} aria-live="polite" role="status">{PHASE_STATUS[room.phase] ?? room.phase}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${room.phase}-${round}`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -14 }}
          transition={{ duration: 0.18 }}
        >
      {room.phase === "LOBBY" && (
        <div style={doneCard}>
          <p style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <EyeIcon size={24} /> {JOINED_LOBBY_TITLE}
          </p>
          <p style={{ opacity: 0.7 }}>{JOINED_LOBBY_SUB}</p>
          <p style={{ opacity: 0.7 }}>Best of {room.total_rounds ?? 3} — whose lead holds?</p>
        </div>
      )}

      {room.phase === "INPUT" && (!mySub || editing) && (
        <>
          {isDraw ? (
            <>
              <p style={{ fontSize: 16, opacity: 0.8, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
                <DrawIcon size={20} /> {room.prompt_hint ?? "What does yours look like?"}
              </p>
              <DrawPad disabled={false} onDone={submitDrawing} />
            </>
          ) : (
            <>
              <motion.textarea
                value={text}
                onChange={(e) => onText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    void submit();
                  }
                }}
                placeholder={room.prompt_hint ?? "What's your answer?"}
                rows={4}
                maxLength={MAX_LEN}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint="send"
                whileFocus={reduce ? undefined : { scale: 1.02 }}
                style={input}
              />
              <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>
                {text.length}/{MAX_LEN} · {room.prompt_hint ?? "What's the funniest version?"}
              </div>
              <motion.button
                onClick={submit}
                whileTap={{ scale: 0.95 }}
                style={btn}
              >
                {editing ? "Save changes" : "Submit answer"}
              </motion.button>
              {editing && (
                <button onClick={() => setEditing(false)} style={linkBtn}>
                  Never mind
                </button>
              )}
            </>
          )}
          {submitErr && <p style={{ color: "#ff8a8a" }}>{submitErr}</p>}
        </>
      )}

      {room.phase === "INPUT" && mySub && !editing && (
        <div style={doneCard}>
          <AnimatePresence>
            <motion.svg width={72} height={72} viewBox="0 0 72 72" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ marginTop: 4 }}>
              <motion.circle cx={36} cy={36} r={30} fill="none" stroke="#34d399" strokeWidth={5} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5 }} />
              <motion.path d="M24 37l8 8 16-16" fill="none" stroke="#34d399" strokeWidth={6} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.3 }} />
            </motion.svg>
          </AnimatePresence>
          <p style={{ fontSize: 20, fontWeight: 700 }}>{SUBMITTED_TITLE}</p>
          {myDraft && <p style={{ opacity: 0.8, margin: "4px 0" }}>“{myDraft}”</p>}
          <p style={{ opacity: 0.7, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <EyeIcon size={22} /> {room.counts?.submitted ?? room.submissions.length}/{Math.max(room.counts?.total ?? room.players.length, 1)} in — whose is best?
          </p>
          {!isDraw && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setText(myDraft);
                setEditing(true);
              }}
              style={{ ...btn, fontSize: 18, marginTop: 10, background: "#fff" }}
            >
              Edit answer
            </motion.button>
          )}
        </div>
      )}

      {room.phase === "REVEAL" && (
        <div style={doneCard}>
          <p style={{ fontSize: 24, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <EyeIcon size={26} /> {REVEAL_LOOKUP_TITLE}
          </p>
          <p style={{ opacity: 0.7 }}>{REVEAL_LOOKUP_SUB}</p>
          {mySub && (
            <p style={{ opacity: 0.7 }}>
              Your answer:{" "}
              {mySub.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mySub.image_url} alt="Your drawing" style={{ width: "100%", borderRadius: 10, border: "2px solid #111", background: "#fff", marginTop: 6 }} />
              ) : (
                `“${mySub.text_content}”`
              )}
            </p>
          )}
        </div>
      )}

      {room.phase === "VOTE" && (
        <>
          {voted ? (
            <div style={doneCard}>
              <p style={{ fontSize: 20, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <CheckIcon size={22} animated={!reduce} /> Vote locked in
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
              {mySub && (
                <p style={{ opacity: 0.7 }}>
                  Your answer:{" "}
                  {mySub.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mySub.image_url} alt="Your drawing" style={{ width: "100%", maxWidth: 140, borderRadius: 10, border: "2px solid #111", background: "#fff", marginTop: 6, display: "block" }} />
                  ) : (
                    `“${mySub.text_content}”`
                  )}
                </p>
              )}
            </div>
          ) : (
            votable.map((s) => (
              <motion.button key={s.player_session} onClick={() => vote(s.player_session)} whileTap={{ scale: 0.96 }} style={voteBtn}>
                {s.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image_url} alt="Drawing to vote on" style={{ width: "100%", borderRadius: 10, display: "block", background: "#fff" }} />
                ) : (
                  s.text_content
                )}
              </motion.button>
            ))
          )}
          {voteErr && <p style={{ color: "#ff8a8a" }}>{voteErr}</p>}
        </>
      )}

      {room.phase === "SCORE" && (
        <>
          {final && (
            <p style={{ fontSize: 22, fontWeight: 800, fontFamily: DISPLAY_FONT }}>{FINAL_TITLE}</p>
          )}
          {winner && (
            <p style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              <TrophyIcon size={26} />
              {winner.sessionId === sid ? youWinLine() : myScore ? personalLine(winner.name, myScore.pts) : `${winner.name} wins!`}
            </p>
          )}
          {myRank > 0 && (
            <p style={{ fontWeight: 800, opacity: 0.85 }}>
              You're {ordinal(myRank)} of {sortedScores.length}
              {myBreakdown ? ` · ${myBreakdown}` : ""}
            </p>
          )}
          <ul style={{ listStyle: "none", padding: 0 }}>
            {sortedScores.map((s, i) => (
              <li key={s.sessionId} style={s.sessionId === sid ? { ...scoreLi, border: "2px solid #7c3aed" } : scoreLi}>
                {i + 1}. {s.name}: {s.pts}
              </li>
            ))}
          </ul>
          {room.submissions.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 16, fontWeight: 800, letterSpacing: 1, opacity: 0.85 }}>WHO WROTE WHAT</p>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {room.submissions
                  .slice()
                  .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0))
                  .map((s) => (
                    <li key={s.player_session} style={{ ...scoreLi, fontSize: 17 }}>
                      <span style={{ color: "#7c3aed" }}>{nameOf(room, s.player_session)}</span>
                      {s.image_url ? (
                        <span>
                          {" — "}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={s.image_url} alt={`Drawing by ${nameOf(room, s.player_session)}`} style={{ width: "100%", maxWidth: 160, borderRadius: 10, border: "2px solid #111", background: "#fff", display: "block", marginTop: 6 }} />
                        </span>
                      ) : (
                        <span>{" — “"}{s.text_content}{"”"}</span>
                      )}
                      <span style={{ opacity: 0.7 }}> · {s.votes ?? 0} {s.votes === 1 ? "vote" : "votes"}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {final && <p style={{ opacity: 0.7 }}>{FINAL_SUB} Rematch — who's back?</p>}
        </>
      )}
        </motion.div>
      </AnimatePresence>
    </main>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

const wrap: React.CSSProperties = { padding: 20, maxWidth: 520, margin: "0 auto", minHeight: "100dvh", color: "#fff" };
const codePill: React.CSSProperties = { display: "inline-block", fontFamily: DISPLAY_FONT, fontSize: 15, letterSpacing: 2, background: THEME.pink, color: "#111", border: "3px solid #111", borderRadius: 999, padding: "6px 14px", boxShadow: "3px 3px 0 #111", margin: "0 0 10px" };
const phoneTitle: React.CSSProperties = { fontFamily: DISPLAY_FONT, fontSize: 40, color: THEME.yellow, margin: "8px 0", textShadow: "-2px -2px 0 #111, 2px -2px 0 #111, -2px 2px 0 #111, 2px 2px 0 #111" };
const promptCard: React.CSSProperties = { ...answerCard, fontSize: 24, padding: "16px 18px", margin: "8px 0" };
const input: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", padding: 16, fontSize: 20, fontWeight: 700, borderRadius: 14, margin: "12px 0", border: "3px solid #111", background: "#fff", color: "#111", outline: "none", minHeight: 56 };
const btn: React.CSSProperties = { ...phoneBtn, padding: 16, fontSize: 22, margin: "8px 0" };
const voteBtn: React.CSSProperties = { ...answerCard, display: "block", width: "100%", boxSizing: "border-box", padding: 16, fontSize: 20, fontWeight: 800, margin: "8px 0", cursor: "pointer", textAlign: "left" };
const doneCard: React.CSSProperties = { ...answerCard, padding: 18, textAlign: "center" };
const scoreLi: React.CSSProperties = { ...answerCard, fontSize: 20, fontWeight: 800, padding: "10px 14px", margin: "6px 0", listStyle: "none" };
const linkBtn: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", margin: "8px 0 0", padding: 12, fontSize: 16, fontWeight: 800, borderRadius: 12, background: "transparent", color: "#fff", border: "2px solid rgba(255,255,255,0.35)", cursor: "pointer" };
