"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionId } from "@/lib/gameEngine";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function createRoom() {
    setBusy(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const room = await res.json();
      if (!res.ok) throw new Error(room.error);
      // Creator opens the TV host view; players scan/join via /play/[code].
      router.push(`/host/${room.code}`);
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    if (!code.trim() || !name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${code.trim().toUpperCase()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), session_id: getSessionId() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/play/${code.trim().toUpperCase()}?name=${encodeURIComponent(name.trim())}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: "40px auto", padding: 24 }}>
      <h1>Saturday Bones</h1>
      <p>Laptop = TV host screen. Phones = controllers. No app install.</p>
      <button onClick={createRoom} disabled={busy} style={btn}>
        Create room (TV)
      </button>
      <hr style={{ margin: "24px 0", opacity: 0.3 }} />
      <h2>Join on your phone</h2>
      <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} style={input} />
      <input placeholder="Room code (e.g. AB12)" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={input} />
      <button onClick={joinRoom} disabled={busy} style={btn}>
        Join room
      </button>
    </main>
  );
}

const input: React.CSSProperties = {
  display: "block", width: "100%", padding: 14, fontSize: 18, margin: "8px 0", borderRadius: 8, border: "1px solid #444",
};

const btn: React.CSSProperties = {
  display: "block", width: "100%", padding: 16, fontSize: 20, margin: "8px 0", borderRadius: 10,
  background: "#7c3aed", color: "#fff", border: "none", cursor: "pointer",
};
