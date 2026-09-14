"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "motion/react";
import { getSessionId } from "@/lib/gameEngine";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 260, damping: 22 },
  },
};

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
    <motion.main
      variants={container}
      initial="hidden"
      animate="show"
      style={page}
    >
      <div style={card}>
        <motion.div variants={item} style={{ textAlign: "center" }}>
          <motion.h1
            animate={{ y: [0, -4, 0, 4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={title}
          >
            Saturday Bones
          </motion.h1>
          <p style={subtitle}>
            Laptop = TV host screen. Phones = controllers. No app install.
          </p>
        </motion.div>

        <motion.div variants={item}>
          <motion.button
            onClick={createRoom}
            disabled={busy}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={primaryBtn}
          >
            Create Game
          </motion.button>
        </motion.div>

        <motion.section variants={item} style={joinSection}>
          <h2 style={joinHeading}>Join Game</h2>
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
            style={input}
          />
          <motion.input
            placeholder="Code (e.g. AB12)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={4}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            whileFocus={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 0.18 }}
            style={{ ...input, textTransform: "uppercase" }}
          />
          <motion.button
            onClick={joinRoom}
            disabled={busy}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={secondaryBtn}
          >
            Join Game
          </motion.button>
        </motion.section>
      </div>
    </motion.main>
  );
}

const page: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box",
  // slate-950 (#020617) -> indigo-950 (#1e1b4b), subtle radial lift
  background:
    "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(99,102,241,0.18), transparent 70%), linear-gradient(160deg, #020617 0%, #0b0a2a 55%, #1e1b4b 100%)",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  boxSizing: "border-box",
  padding: "clamp(24px, 5vw, 40px)",
  borderRadius: 20,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "0 24px 64px rgba(0,0,0,0.45)",
  backdropFilter: "blur(8px)",
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: "clamp(2.5rem, 8vw, 3.5rem)",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  lineHeight: 1.05,
  color: "#fff",
};

const subtitle: React.CSSProperties = {
  margin: "12px 0 0",
  fontSize: 16,
  lineHeight: 1.5,
  color: "rgba(255,255,255,0.7)",
};

const primaryBtn: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 16,
  fontSize: 20,
  fontWeight: 600,
  margin: "24px 0 0",
  borderRadius: 12,
  background: "#7c3aed",
  color: "#fff",
  border: "none",
  cursor: "pointer",
  minHeight: 56,
};

const joinSection: React.CSSProperties = {
  marginTop: 24,
  paddingTop: 24,
  borderTop: "1px solid rgba(255,255,255,0.12)",
};

const joinHeading: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 20,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  textAlign: "center",
  color: "#fff",
};

const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 14,
  fontSize: 18,
  margin: "8px 0",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(0,0,0,0.35)",
  color: "#fff",
  outline: "none",
  minHeight: 52,
};

const secondaryBtn: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 16,
  fontSize: 20,
  fontWeight: 600,
  margin: "8px 0 0",
  borderRadius: 12,
  background: "rgba(255,255,255,0.12)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.2)",
  cursor: "pointer",
  minHeight: 56,
};
