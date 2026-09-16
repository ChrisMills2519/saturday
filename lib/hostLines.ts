// Saturday voice queue builder: turns room snapshots into speak calls.
// Pure line-selection + thin speak wrappers so the host page stays dumb.
// Rules: roast answers + the room, never the person (see hostPersonality).
// User text is sanitized before speech: collapsed, URL-stripped, capped.

import { speak, cancelVoice, type SpeakOpts, type SarcasmMode, type LineType } from "./voice";
import { pickLine, type Slot } from "./hostPersonality";
import { collapseSpaces } from "./gameEngine";

export const SPEAK_MAX = 120;

export function sanitizeForSpeech(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = collapseSpaces(raw);
  s = s.replace(/https?:\/\/\S+/g, "link").replace(/www\.\S+/g, "link");
  if (s.length > SPEAK_MAX) s = `${s.slice(0, SPEAK_MAX - 1)}…`;
  return s;
}

export type SubmissionLike = {
  player_session: string;
  text_content: string | null;
  image_url: string | null;
  votes?: number;
};

/** Rough speech time for chaining: ~14 chars/sec + beat gaps. */
export function estimateMs(text: string): number {
  const beats = (text.match(/\[beat\]/g) ?? []).length;
  const dots = (text.match(/\.\.\./g) ?? []).length;
  return Math.max(3000, (text.length / 14) * 1000 + beats * 450 + dots * 350 + 800);
}
/** Speak a raw line with priority shorthand. Re-export so host page imports once. */
export function say(text: string, opts: SpeakOpts = {}): boolean {
  return speak(text, opts);
}

export function shutUp(): void {
  cancelVoice();
}

/** Phase-entry line: returns the VoiceLine so the page can speak with priority. */
export function phaseLine(
  phase: string,
  mode: SarcasmMode,
  used: Set<string>,
): { text: string; type: LineType; priority: number } | null {
  switch (phase) {
    case "LOBBY": {
      const v = pickLine("lobby_cold_open", mode, used);
      return { ...v, priority: 10 };
    }
    case "INPUT": {
      const v = pickLine("input_opener", mode, used);
      return { ...v, priority: 10 };
    }
    case "REVEAL": {
      const v = pickLine("reveal_opener", mode, used);
      return { ...v, priority: 10 };
    }
    case "VOTE": {
      const v = pickLine("vote_opener", mode, used);
      return { ...v, priority: 10 };
    }
    case "SCORE": {
      const v = pickLine("score_winner", mode, used);
      // Winner is the mic-drop: uninterruptible.
      return { ...v, priority: 20 };
    }
    default:
      return null;
  }
}

function slotPriority(slot: Slot): number {
  switch (slot) {
    case "score_winner":
    case "score_unanimous":
      return 20;
    case "lobby_cold_open":
    case "input_opener":
    case "reveal_opener":
    case "vote_opener":
      return 10;
    case "reveal_drawing":
      return 5;
    default:
      return 1;
  }
}

/** Speak a personality slot (one-liners, snark, awards). */
export function saySlot(slot: Slot, mode: SarcasmMode, used: Set<string>): boolean {
  const v = pickLine(slot, mode, used);
  return speak(v.text, { type: v.type, priority: slotPriority(slot) });
}

/**
 * Speak one revealed answer card. Text answers read verbatim (sanitized);
 * drawings get a personality aside instead. Priority 5: a new card preempts
 * a pending one-liner, but never a phase opener already talking.
 */
export function sayAnswer(
  sub: SubmissionLike,
  mode: SarcasmMode,
  used: Set<string>,
  index: number,
  total: number,
): boolean {
  if (sub.image_url && !sub.text_content) {
    const v = pickLine("reveal_drawing", mode, used);
    return speak(v.text, { type: v.type, priority: 5 });
  }
  const clean = sanitizeForSpeech(sub.text_content);
  if (!clean) {
    const v = pickLine("reveal_drawing", mode, used);
    return speak(v.text, { type: v.type, priority: 5 });
  }
  // Number the walk so the room can follow along: "Number three... <answer>."
  const prefix = total > 1 ? `Number ${index + 1}... ` : "";
  return speak(`${prefix}${clean}`, { type: "setup", priority: 5 });
}

/** Score extras: shutout / unanimous, spoken after the winner line.
 * leadMs should be the winner line's estimated speech time so extras
 * don't collide with the sticky mic-drop (they'd lose priority and drop). */
export function scoreExtras(
  subs: SubmissionLike[],
  mode: SarcasmMode,
  used: Set<string>,
  leadMs = 3500,
): void {
  let delay = leadMs;
  const queue = (text: string, type: LineType) => {
    const d = delay;
    delay += 4000;
    setTimeout(() => speak(text, { type, priority: 4 }), d);
  };
  const shutout = subs.find((s) => (s.votes ?? 0) === 0);
  if (shutout && subs.length >= 2) {
    const v = pickLine("score_shutout", mode, used);
    queue(v.text, v.type);
  }
  const top = subs.reduce<SubmissionLike | null>((b, s) => (!b || (s.votes ?? 0) > (b.votes ?? 0) ? s : b), null);
  if (top && (top.votes ?? 0) >= 2 && subs.length >= 3) {
    const v = pickLine("score_unanimous", mode, used);
    // Only call it unanimous-ish; the picker copy hedges honestly.
    queue(v.text, v.type);
  }
}
