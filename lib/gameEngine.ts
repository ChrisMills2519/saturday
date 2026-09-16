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

export type GameType = "text" | "draw" | "quiz-classic" | "quiz-bluff";

export function canTransition(from: Phase, to: Phase, gameType?: string | null): boolean {
  if (VALID_TRANSITIONS[from]?.includes(to) ?? false) return true;
  // Quiz-classic has no INPUT phase (nothing to write — phones pick A–D):
  // rounds open straight into REVEAL (question + choices on screen).
  if (gameType === "quiz-classic" && to === "REVEAL" && (from === "LOBBY" || from === "SCORE"))
    return true;
  return false;
}

// Limits + scoring rubber-band: final round is double and unanimous gets a kicker.
export const MAX_PLAYERS = 8;
export const NAME_MAX = 16;
export const ANSWER_MAX = 140;
export const INPUT_SECONDS = 60;
export const VOTE_SECONDS = 30;
// Quiz-classic read window: question + choices on TV before VOTE opens.
export const QUIZ_READ_SECONDS = 15;
// REVEAL show window: matches the host card-slam cadence (700ms first card,
// ~2300ms per card after). Floor of 7s so tiny rounds still breathe.
export function revealSeconds(count: number): number {
  return Math.max(7, Math.round(1.5 + 2.3 * Math.max(0, count)));
}
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

// Quiz scoring. Classic: points go to the VOTER who picks the correct house
// choice (one vote scale, same as a bluff vote) + a speed kicker for the
// first correct voter. Bluff: normal author-points for fakes + a finder
// bonus for voters who spot the truth. Unanimous kicker is bluff/text-only.
export const QUIZ_SPEED_BONUS = 50;
export const QUIZ_FINDER = 100;

export function quizCorrectWorth(voterCount: number, isFinal: boolean): number {
  return voteWorth(voterCount, isFinal);
}
export function quizSpeedBonus(isFinal: boolean): number {
  return QUIZ_SPEED_BONUS * (isFinal ? FINAL_MULTIPLIER : 1);
}
export function quizFinderWorth(isFinal: boolean): number {
  return QUIZ_FINDER * (isFinal ? FINAL_MULTIPLIER : 1);
}

export function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function makeHostToken(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for environments without crypto (shouldn't happen in modern runtimes)
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
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
