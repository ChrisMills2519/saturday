"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { phoneBtn } from "@/lib/theme";

// Drawful-style pad. One brush, three sizes, undo, clear — submits ONCE
// as a data URL (no per-stroke streaming, per AGENTS.md).
const W = 480;
const H = 360;
const COLORS = ["#111111", "#ff2e9a", "#7c3aed", "#22cc88", "#ffcf0d", "#2b7fff", "#ffffff"];

export function DrawPad({
  disabled,
  onDone,
}: {
  disabled?: boolean;
  onDone: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
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
    if (disabled) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    snapshot();
    drawing.current = true;
    last.current = pos(e);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
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
  function up() {
    drawing.current = false;
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
    if (!c) return;
    setBusy(true);
    let url = c.toDataURL("image/png");
    if (url.length > 500_000) url = c.toDataURL("image/jpeg", 0.6);
    onDone(url);
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            aria-label={`Brush ${c}`}
            aria-pressed={color === c}
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              background: c,
              border: color === c ? "3px solid #ffcf0d" : "3px solid #111",
              boxShadow: "2px 2px 0 #111",
              cursor: "pointer",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
        {[3, 7, 14].map((s) => (
          <button
            key={s}
            onClick={() => setSize(s)}
            aria-pressed={size === s}
            aria-label={`Brush size ${s}`}
            style={{
              width: 38,
              height: 34,
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
        onPointerLeave={up}
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
        {count === 0 ? "Finger-paint it. Stick figures win hearts." : "Looks great. Send it before the clock dies."}
      </p>
      <motion.button whileTap={{ scale: 0.96 }} onClick={submit} disabled={disabled || busy} style={{ ...phoneBtn, padding: 16, fontSize: 22, marginTop: 8 }}>
        {busy ? "Sending…" : "Submit drawing"}
      </motion.button>
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 14,
  fontWeight: 800,
  borderRadius: 10,
  border: "3px solid #111",
  background: "#fff",
  color: "#111",
  cursor: "pointer",
  minHeight: 34,
};
