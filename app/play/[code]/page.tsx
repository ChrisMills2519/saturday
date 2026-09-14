"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSessionId } from "@/lib/gameEngine";
import { clearDraft, loadDraft, loadJoin, saveDraft, saveJoin } from "@/lib/persistence";
import { useRoom, useCountdown, type RoomSnapshot } from "@/lib/realtime";

export default function PlayPage({ params }: { params: { code: string } }) {
  return (
    <Suspense fallback={<main style={wrap}><p>Loading…</p></main>}>
      <PlayInner code={params.code} />
    </Suspense>
  );
}

function PlayInner({ code }: { code: string }) {
  const search = useSearchParams();
  const [name, setName] = useState(search.get("name") ?? "");
  const [joined, setJoined] = useState(!!search.get("name"));
  const [initial, setInitial] = useState<RoomSnapshot | null>(null);
  const [text, setText] = useState("");
  const autoJoined = useRef(false);

  useEffect(() => {
    fetch(`/api/rooms/${code}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((snap) => {
        // RoomSnapshot from a fresh DB has no current_round on old payloads;
        // default so draft keys stay stable.
        if (snap && typeof snap.current_round !== "number") snap.current_round = 0;
        setInitial(snap);
      })
      .catch(() => {});
  }, [code]);

  const room = useRoom(code, initial);
  const round = room?.current_round ?? initial?.current_round ?? 0;
  const left = useCountdown(room?.ends_at ?? null);

  // Silent rejoin: a browser refresh must return the player to the game,
  // not the join form. Explicit ?name= wins over stored join.
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

  // Restore draft for this round (e.g. after a refresh mid-typing).
  useEffect(() => {
    if (!joined || room?.phase !== "INPUT") return;
    setText((cur) => (cur ? cur : loadDraft(code, round)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, code, round, room?.phase]);

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
    setText(v);
    saveDraft(code, round, v);
  }

  async function submit() {
    if (!text.trim()) return;
    await fetch(`/api/rooms/${code}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: getSessionId(), text_content: text.trim() }),
    });
    clearDraft(code, round);
    setText("");
  }

  async function vote(player_session: string) {
    await fetch(`/api/rooms/${code}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: getSessionId(), target_session: player_session }),
    });
  }

  if (!joined) {
    return (
      <main style={wrap}>
        <h1>Join {code}</h1>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={input} />
        <button onClick={join} style={btn}>Join</button>
      </main>
    );
  }

  if (!room) return <main style={wrap}><p>Loading…</p></main>;

  return (
    <main style={wrap}>
      <h1 style={{ fontSize: 28 }}>{room.prompt ?? `Room ${code} — waiting…`}</h1>
      {left !== null && <p style={{ fontSize: 22 }}>⏱ {left}s</p>}
      <p>Phase: {room.phase}</p>

      {room.phase === "INPUT" && (
        <>
          <textarea value={text} onChange={(e) => onText(e.target.value)} placeholder="Your answer…" rows={4} style={input} />
          <button onClick={submit} style={btn}>Submit</button>
        </>
      )}

      {room.phase === "VOTE" && (
        <>
          {room.submissions
            .filter((s) => s.player_session !== getSessionId())
            .map((s, i) => (
              <button key={i} onClick={() => vote(s.player_session)} style={voteBtn}>
                {s.text_content ?? "(drawing coming in v2)"}
              </button>
            ))}
        </>
      )}

      {room.phase === "SCORE" && (
        <ul>
          {Object.entries(room.scores).map(([n, sc]) => (
            <li key={n}>{n}: {sc}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

const wrap: React.CSSProperties = { padding: 20, maxWidth: 520, margin: "0 auto" };
const input: React.CSSProperties = { display: "block", width: "100%", padding: 14, fontSize: 18, borderRadius: 10, margin: "12px 0" };
const btn: React.CSSProperties = { display: "block", width: "100%", padding: 16, fontSize: 20, borderRadius: 10, background: "#7c3aed", color: "#fff", border: "none" };
const voteBtn: React.CSSProperties = { ...btn, background: "#1f2937", margin: "8px 0" };
