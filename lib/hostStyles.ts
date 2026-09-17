import { DISPLAY_FONT, THEME } from "@/lib/theme";

export const CHIP_COLORS = [THEME.pink, THEME.teal, THEME.yellow, THEME.blue, "#a78bfa"];

export const wrap: React.CSSProperties = { padding: 32, maxWidth: 1400, margin: "0 auto", color: "#fff", minHeight: "100dvh" };
export const topbar: React.CSSProperties = { display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap", background: "rgba(0,0,0,0.35)", border: "3px solid #111", borderRadius: 18, padding: "16px 20px", boxShadow: "6px 6px 0 #111" };
export const sub: React.CSSProperties = { fontSize: 20, opacity: 0.9 };
export const promptHero: React.CSSProperties = {
  fontFamily: DISPLAY_FONT,
  fontSize: "clamp(28px, 4vw, 44px)",
  background: "#fff",
  color: "#111",
  border: "3px solid #111",
  borderRadius: 16,
  boxShadow: "6px 6px 0 #111",
  padding: "18px 22px",
  margin: "12px 0",
};
// Revealed answers are the main event — display font, readable across the room.
export const answerText: React.CSSProperties = {
  fontFamily: DISPLAY_FONT,
  fontSize: "clamp(24px, 3vw, 36px)",
  fontWeight: 800,
  lineHeight: 1.2,
};
export const paceToggle: React.CSSProperties = {
  padding: "6px 14px",
  fontSize: 16,
  fontWeight: 800,
  borderRadius: 999,
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  border: "2px solid rgba(255,255,255,0.4)",
  cursor: "pointer",
};
export const chip: React.CSSProperties = { fontSize: 22, fontWeight: 800, color: "#111", padding: "10px 18px", borderRadius: 999, border: "3px solid #111", boxShadow: "4px 4px 0 #111" };
export const card: React.CSSProperties = { padding: 20, minHeight: 100 };
export const gridStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 };
export const bigBtn: React.CSSProperties = { padding: "16px 32px", fontSize: 24, marginTop: 12 };
export const stepBtn: React.CSSProperties = { width: 44, height: 44, fontSize: 24, fontWeight: 800, borderRadius: 12, border: "3px solid #111", background: "#fff", color: "#111", boxShadow: "3px 3px 0 #111", cursor: "pointer" };
export const podiumBar: React.CSSProperties = { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: 6, padding: 14, borderRadius: 14, border: "3px solid #111", boxShadow: "5px 5px 0 #111" };
export const soundBtn: React.CSSProperties = { position: "fixed", bottom: 16, right: 16, zIndex: 60, padding: "10px 16px", fontSize: 15, fontWeight: 800, borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", cursor: "pointer" };
export const kickBtn: React.CSSProperties = { padding: "8px 14px", fontSize: 15, fontWeight: 800, borderRadius: 999, background: "rgba(255,255,255,0.10)", color: THEME.errorMuted, border: "2px solid rgba(255,120,120,0.55)", cursor: "pointer" };
