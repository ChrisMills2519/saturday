"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants, useReducedMotion } from "motion/react";
import { getSessionId } from "@/lib/gameEngine";
import { setHostToken } from "@/lib/hostToken";
import { THEME, DISPLAY_FONT, IMAGES } from "@/lib/theme";
import { Mascot } from "@/components/Mascot";

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
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();

  async function createRoom() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      const room = await res.json();
      if (!res.ok) throw new Error(room.error);
      if (room.host_token) setHostToken(room.code, room.host_token);
      router.push(`/host/${room.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create game — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    if (!code.trim() || !name.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${code.trim().toUpperCase()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), session_id: getSessionId() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Server may dedupe ("Alex (2)") — carry the settled name forward.
      const settled = typeof data?.name === "string" && data.name.trim() ? data.name.trim() : name.trim();
      router.push(`/play/${code.trim().toUpperCase()}?name=${encodeURIComponent(settled)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join — check the code and try again.");
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
          <Mascot src={IMAGES.lobby} alt="Saturday host" size={150} />
          <motion.h1
            animate={{ y: [0, -4, 0, 4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={title}
          >
            SATURDAY
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
            {busy ? "Creating…" : "Create Game"}
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
            whileFocus={reduce ? undefined : { scale: [1, 1.02, 1] }}
            transition={{ duration: 0.18 }}
            style={{ ...input, textTransform: "uppercase" }}
          />
          <motion.button
            onClick={joinRoom}
            disabled={busy || !code.trim() || !name.trim()}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.15 }}
            style={secondaryBtn}
          >
            {busy ? "Joining…" : "Join Game"}
          </motion.button>
          {error && <p role="alert" style={{ color: "#f87171", fontSize: 16, fontWeight: 700, marginTop: 8, textAlign: "center" }}>{error}</p>}
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
  background:
    "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(255,46,154,0.25), transparent 70%), linear-gradient(160deg, #0d0618 0%, #1a0b2e 55%, #2a1458 100%)",
};

const card: React.CSSProperties = {
  width: "100%",
  maxWidth: 480,
  boxSizing: "border-box",
  padding: "clamp(24px, 5vw, 40px)",
  borderRadius: 20,
  background: "rgba(0,0,0,0.4)",
  border: "3px solid #111",
  boxShadow: "8px 8px 0 #111",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const title: React.CSSProperties = {
  margin: 0,
  fontFamily: DISPLAY_FONT,
  fontSize: "clamp(3rem, 10vw, 4.5rem)",
  letterSpacing: "0.02em",
  lineHeight: 1,
  color: THEME.yellow,
  textShadow: "-3px -3px 0 #111, 3px -3px 0 #111, -3px 3px 0 #111, 3px 3px 0 #111, 0 6px 0 rgba(0,0,0,0.45)",
};

const subtitle: React.CSSProperties = {
  margin: "12px 0 0",
  fontSize: 17,
  fontWeight: 700,
  lineHeight: 1.5,
  color: "#fff",
};

const primaryBtn: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 16,
  fontSize: 22,
  fontFamily: DISPLAY_FONT,
  margin: "24px 0 0",
  borderRadius: 14,
  background: THEME.yellow,
  color: "#111",
  border: "3px solid #111",
  boxShadow: "5px 5px 0 #111",
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
  fontSize: 22,
  fontFamily: DISPLAY_FONT,
  textAlign: "center",
  color: THEME.teal,
};

const input: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 14,
  fontSize: 18,
  fontWeight: 700,
  margin: "8px 0",
  borderRadius: 12,
  border: "3px solid #111",
  background: "#fff",
  color: "#111",
  outline: "none",
  minHeight: 52,
};

const secondaryBtn: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 16,
  fontSize: 22,
  fontFamily: DISPLAY_FONT,
  margin: "8px 0 0",
  borderRadius: 14,
  background: "#fff",
  color: "#111",
  border: "3px solid #111",
  boxShadow: "5px 5px 0 #111",
  cursor: "pointer",
  minHeight: 56,
};
