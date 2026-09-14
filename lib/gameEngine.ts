export type Phase = "LOBBY" | "INPUT" | "REVEAL" | "VOTE" | "SCORE";

// Bones state machine. Same engine drives text games now,
// Drawful-style image game later (submit image_url instead of text).
export const VALID_TRANSITIONS: Record<Phase, Phase[]> = {
  LOBBY: ["INPUT"],
  INPUT: ["REVEAL"],
  REVEAL: ["VOTE"],
  VOTE: ["SCORE"],
  SCORE: ["INPUT", "LOBBY"],
};

export function canTransition(from: Phase, to: Phase): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// 4-char room codes, no confusing 0/O/1/I. Easy to shout across the room.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function makeRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem("saturday_session");
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem("saturday_session", id);
  }
  return id;
}
