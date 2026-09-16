// Quiz-round shared helpers (client + server safe, no supabase imports).
// Both quiz modes ride on "house" submissions: server-inserted rows whose
// player_session starts with `quiz:` so every downstream consumer (blind
// INPUT redaction, VOTE tallies, one-vote guard, auto-advance) works
// untouched. Only scoring forks on game_type.

import { shuffledChoicesFor, type QuizCard } from "./prompts_quiz";

export const HOUSE_PREFIX = "quiz:";
// Classic choices, aligned with QuizState.choices by index.
export const QUIZ_HOUSE_SESSIONS = ["quiz:A", "quiz:B", "quiz:C", "quiz:D"];
// Bluff truth row (a real answer shuffled among player fakes).
export const QUIZ_TRUTH_SESSION = "quiz:truth";

export function isHouseSession(s: string | null | undefined): boolean {
  return typeof s === "string" && s.startsWith(HOUSE_PREFIX);
}

/** What's stored in rooms.quiz_state (server writes, snapshot redacts). */
export type QuizState = {
  quiz_id: string;
  /** Choice texts aligned with QUIZ_HOUSE_SESSIONS by index (classic). */
  choices: string[];
  correct_index: number;
  /** Which house session holds the truth (quiz:A-D or quiz:truth). */
  correct_session: string;
};

export function buildClassicState(card: QuizCard): QuizState {
  const { options, correctIndex } = shuffledChoicesFor(card);
  return {
    quiz_id: card.id,
    choices: options,
    correct_index: correctIndex,
    correct_session: QUIZ_HOUSE_SESSIONS[correctIndex],
  };
}

export function buildBluffTruth(): string {
  return QUIZ_TRUTH_SESSION;
}

export function parseQuizState(room: unknown): QuizState | null {
  const raw = (room as Record<string, unknown> | null)?.quiz_state as Record<string, unknown> | null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.correct_session !== "string" || !isHouseSession(raw.correct_session)) return null;
  return {
    quiz_id: typeof raw.quiz_id === "string" ? raw.quiz_id : "",
    choices: Array.isArray(raw.choices) ? (raw.choices as string[]) : [],
    correct_index: typeof raw.correct_index === "number" ? raw.correct_index : -1,
    correct_session: raw.correct_session,
  };
}

/** A–D letter for a classic house session (UI badges). */
export function letterForSession(session: string): string | null {
  const i = QUIZ_HOUSE_SESSIONS.indexOf(session);
  return i >= 0 ? "ABCD"[i] : null;
}
