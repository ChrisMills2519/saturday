// Saturday Quiplash-bold theme. Single source of truth for TV + phones
// + landing. User PNGs drop into public/images/ (see public/images/README.md)
// — everything degrades to CSS burst + walkers when files are missing.
export const THEME = {
  plum: "#1a0b2e",
  plumDeep: "#0d0618",
  purple: "#7c3aed",
  pink: "#ff2e9a",
  yellow: "#ffcf0d",
  teal: "#22ffcc",
  ink: "#111111",
  white: "#ffffff",
} as const;

export const DISPLAY_FONT =
  "'Titan One', 'Baloo 2', 'Arial Black', system-ui, sans-serif";
export const BODY_FONT =
  "'Nunito', system-ui, -apple-system, sans-serif";

export const IMAGES = {
  lobby: "/images/mascot-lobby.png",
  reveal: "/images/mascot-reveal.png",
  score: "/images/mascot-score.png",
  bg: "/images/bg-burst.png",
} as const;

// Chunky outline headline, Quiplash-style. Yellow on plum.
export function outlineTitle(size: number): React.CSSProperties {
  return {
    fontFamily: DISPLAY_FONT,
    fontSize: size,
    lineHeight: 1,
    letterSpacing: "-0.01em",
    color: THEME.yellow,
    margin: 0,
    textShadow:
      "-3px -3px 0 #111, 3px -3px 0 #111, -3px 3px 0 #111, 3px 3px 0 #111, 0 6px 0 rgba(0,0,0,0.45)",
  };
}

export const stageBg: React.CSSProperties = {
  background:
    "radial-gradient(ellipse 90% 70% at 50% 15%, rgba(124,58,237,0.55), transparent 65%), radial-gradient(ellipse 70% 60% at 80% 100%, rgba(255,46,154,0.35), transparent 60%), linear-gradient(165deg, #0d0618 0%, #1a0b2e 55%, #2a1458 100%)",
};

export const answerCard: React.CSSProperties = {
  background: "#fff",
  color: "#111",
  border: "3px solid #111",
  borderRadius: 16,
  boxShadow: "6px 6px 0 #111",
};

export const tvBtn: React.CSSProperties = {
  fontFamily: DISPLAY_FONT,
  background: THEME.yellow,
  color: "#111",
  border: "3px solid #111",
  borderRadius: 14,
  boxShadow: "5px 5px 0 #111",
  cursor: "pointer",
};

export const phoneBtn: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: DISPLAY_FONT,
  background: THEME.yellow,
  color: "#111",
  border: "3px solid #111",
  borderRadius: 14,
  boxShadow: "4px 4px 0 #111",
  cursor: "pointer",
};
