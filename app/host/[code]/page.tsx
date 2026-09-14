"use client";
import { useEffect, useState } from "react";
import { useRoom, useCountdown, type RoomSnapshot } from "@/lib/realtime";

export default function HostPage({ params }: { params: { code: string } }) {
  const { code } = params;
  const [initial, setInitial] = useState<RoomSnapshot | null>(null);

  useEffect(() => {
    fetch(`/api/rooms/${code}`, { cache: "no-store" })
      .then((r) => r.json())
      .then(setInitial)
      .catch(() => {});
  }, [code]);

  const room = useRoom(code, initial);
  const left = useCountdown(room?.ends_at ?? null);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const joinUrl = `${appUrl}/play/${code}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(joinUrl)}`;

  async function post(path: string, body?: unknown) {
    await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  if (!room) return <main style={wrap}><h1>{code}</h1><p>Loading room…</p></main>;

  return (
    <main style={wrap}>
      {/* TV-optimized: huge code + QR always visible for in-person;
          hide via ?clean=1 query when screensharing to strangers. */}
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
          {left !== null && <div>⏱ {left}s</div>}
          <div>Players: {room.players.length}</div>
        </div>
      </header>

      {room.phase === "LOBBY" && (
        <section>
          <h2 style={h2}>Lobby</h2>
          <ul>{room.players.map((p) => <li key={p.session_id} style={li}>{p.name}</li>)}</ul>
          <button style={btn} onClick={() => post(`/api/rooms/${code}/start`, { prompt: "Invent a family holiday. Describe it in one sentence." })}>
            Start round
          </button>
        </section>
      )}

      {(room.phase === "INPUT" || room.phase === "REVEAL" || room.phase === "VOTE") && (
        <section>
          <h2 style={h2}>{room.prompt}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {room.submissions.map((s, i) => (
              <div key={i} style={card}>
                {s.image_url ? null : <p style={{ fontSize: 24 }}>{s.text_content}</p>}
                <small>{room.phase === "VOTE" || room.phase === "SCORE" ? `${s.votes} votes` : "submitted"}</small>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button style={btn} onClick={() => post(`/api/rooms/${code}/next`, { to: "REVEAL" })}>Reveal</button>
            <button style={btn} onClick={() => post(`/api/rooms/${code}/next`, { to: "VOTE" })}>Voting</button>
            <button style={btn} onClick={() => post(`/api/rooms/${code}/next`, { to: "SCORE" })}>Scores</button>
          </div>
        </section>
      )}

      {room.phase === "SCORE" && (
        <section>
          <h2 style={h2}>Scores</h2>
          <ul>
            {Object.entries(room.scores).map(([name, score]) => (
              <li key={name} style={li}>{name}: {score}</li>
            ))}
          </ul>
          <button style={btn} onClick={() => post(`/api/rooms/${code}/next`, { to: "INPUT", prompt: "Invent a new pizza topping. Sell it in one sentence." })}>
            Next round
          </button>
        </section>
      )}
    </main>
  );
}

const wrap: React.CSSProperties = { padding: 32, maxWidth: 1200, margin: "0 auto" };
const h2: React.CSSProperties = { fontSize: 40 };
const li: React.CSSProperties = { fontSize: 24 };
const card: React.CSSProperties = { background: "#222", padding: 20, borderRadius: 12, minHeight: 100 };
const btn: React.CSSProperties = { padding: "14px 28px", fontSize: 20, borderRadius: 10, background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer" };
