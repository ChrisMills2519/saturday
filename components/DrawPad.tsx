"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { THEME, phoneBtn } from "@/lib/theme";

// Drawful-style pad. One brush, three sizes, undo, clear — submits ONCE
// as a data URL (no per-stroke streaming, per AGENTS.md).
const W = 480;
const H = 360;
const COLORS = ["#111111", "#ff2e9a", "#7c3aed", THEME.teal, "#ffcf0d", "#2b7fff", "#ffffff"];

export function DrawPad({
  disabled,
  onDone,
}: {
  disabled?: boolean;
  // Return false when the submit failed (network / too large) so the pad
  // can re-enable the button for a retry instead of sticking on "Sending…".
  onDone: (dataUrl: string) => Promise<boolean | void> | boolean | void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const activePointer = useRef<number | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState("#111111");
  const [size, setSize] = useState(7);
  const [history, setHistory] = useState<string[]>([]);
  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);

  // white paper on mount
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  function snapshot() {
    const c = canvasRef.current;
    if (!c) return;
    setHistory((h) => [...h.slice(-9), c.toDataURL("image/png")]);
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || busy) return;
    // Palm rejection: ignore a second simultaneous pointer (resting palm).
    if (drawing.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    snapshot();
    drawing.current = true;
    activePointer.current = e.pointerId;
    last.current = pos(e);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    if (activePointer.current !== null && e.pointerId !== activePointer.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !last.current) return;
    const p = pos(e);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setCount((n) => n + 1);
  }
  function up(e?: React.PointerEvent<HTMLCanvasElement>) {
    if (e && activePointer.current !== null && e.pointerId !== activePointer.current) return;
    drawing.current = false;
    activePointer.current = null;
    last.current = null;
  }

  function undo() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    const prev = history[history.length - 1];
    if (!c || !ctx || !prev) return;
    setHistory((h) => h.slice(0, -1));
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
    };
    img.src = prev;
  }

  function clear() {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    snapshot();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    setCount((n) => n + 1);
  }

  async function submit() {
    const c = canvasRef.current;
    if (!c || count === 0) return;
    setBusy(true);
    try {
      let url = c.toDataURL("image/png");
      if (url.length > 500_000) url = c.toDataURL("image/jpeg", 0.6);
      const r = await onDone(url);
      // Parent returns false on failure → re-enable so the player can retry.
      if (r === false) setBusy(false);
    } catch {
      setBusy(false);
    }
  }

  const blank = count === 0;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Brush ${c}`}
            aria-pressed={color === c}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              background: c,
              border: color === c ? "3px solid #ffcf0d" : "3px solid #111",
              boxShadow: "2px 2px 0 #111",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        {[3, 7, 14].map((s) => (
          <button
            key={s}
            onClick={() => setSize(s)}
            aria-pressed={size === s}
            aria-label={`Brush size ${s}`}
            style={{
              width: 48,
              height: 44,
              borderRadius: 10,
              background: "#fff",
              border: size === s ? "3px solid #7c3aed" : "3px solid #111",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
          >
            <span style={{ width: s + 4, height: s + 4, background: "#111", borderRadius: 999, display: "block" }} />
          </button>
        ))}
        <button onClick={undo} style={smallBtn} disabled={!history.length}>Undo</button>
        <button onClick={clear} style={smallBtn}>Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={() => up()}
        onPointerCancel={() => up()}
        style={{
          width: "100%",
          maxWidth: 480,
          aspectRatio: `${W} / ${H}`,
          background: "#fff",
          border: "3px solid #111",
          borderRadius: 14,
          boxShadow: "4px 4px 0 #111",
          touchAction: "none",
          cursor: disabled ? "not-allowed" : "crosshair",
          display: "block",
        }}
      />
      <p style={{ fontSize: 13, opacity: 0.65, margin: "6px 0 0" }}>
        {blank ? "Finger-paint it. Stick figures win hearts." : "Looks great. Send it before the clock dies."}
      </p>
      <motion.button whileTap={{ scale: 0.96 }} onClick={submit} disabled={disabled || busy || blank} style={{ ...phoneBtn, padding: 16, fontSize: 22, marginTop: 8, opacity: blank ? 0.55 : 1 }}>
        {busy ? "Sending…" : blank ? "Draw something first" : "Submit drawing"}
      </motion.button>
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 15,
  fontWeight: 800,
  borderRadius: 10,
  border: "3px solid #111",
  background: "#fff",
  color: "#111",
  cursor: "pointer",
  minHeight: 44,
};
