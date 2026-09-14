"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSessionId } from "@/lib/gameEngine";
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

  useEffect(() => {
    fetch(`/api/rooms/${code}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setInitial)
      .catch(() => {});
  }, [code]);

  const room = useRoom(code, initial);
  const left = useCountdown(room?.ends_at ?? null);

  async function join() {
    if (!name.trim()) return;
    await fetch(`/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), session_id: getSessionId() }),
    });
    setJoined(true);
  }

  async function submit() {
    if (!text.trim()) return;
    await fetch(`/api/rooms/${code}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: getSessionId(), text_content: text.trim() }),
    });
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
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Your answer…" rows={4} style={input} />
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
