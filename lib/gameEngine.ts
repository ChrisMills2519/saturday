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

// Limits + scoring rubber-band: final round is double and unanimous gets a kicker.
export const MAX_PLAYERS = 8;
export const NAME_MAX = 16;
export const ANSWER_MAX = 140;
export const INPUT_SECONDS = 60;
export const VOTE_SECONDS = 30;
export const SCORE_PER_VOTE = 100;
export const FINAL_MULTIPLIER = 2;
export const UNANIMOUS_BONUS = 250;

export function isFinalRound(cur: number, total: number): boolean {
  return cur >= total;
}
// One vote's worth. The "unanimous" kicker keys off voterCount - 1, not
// voterCount: you can never vote for your own answer, so a clean sweep is
// everyone ELSE picking it. Ties/games with 2 players don't qualify.
export function voteWorth(voterCount: number, isFinal: boolean): number {
  return SCORE_PER_VOTE * (isFinal ? FINAL_MULTIPLIER : 1);
}
export function isCleanSweep(votes: number, voterCount: number): boolean {
  return voterCount >= 3 && votes === voterCount - 1;
}
export function pointsForVote(votes: number, voterCount: number, isFinal: boolean): number {
  let pts = votes * voteWorth(voterCount, isFinal);
  if (isCleanSweep(votes, voterCount)) pts += UNANIMOUS_BONUS;
  return pts;
}

export function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function makeHostToken(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
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
