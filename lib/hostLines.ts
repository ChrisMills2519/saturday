// Saturday voice queue builder: turns room snapshots into speak calls.
// Pure line-selection + thin speak wrappers so the host page stays dumb.
// Rules: roast answers + the room, never the person (see hostPersonality).
// User text is sanitized before speech: collapsed, URL-stripped, capped.

import { speak, cancelVoice, isSpeaking, type SpeakOpts, type SarcasmMode, type LineType } from "./voice";
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
    case "quiz_question":
      return 10;
    case "reveal_drawing":
    case "quiz_correct":
    case "quiz_bluff_sting":
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

/** Slot queued behind real channel silence (SCORE awards behind the winner). */
export function saySlotFree(
  slot: Slot,
  mode: SarcasmMode,
  used: Set<string>,
  waitMs = 0,
): void {
  const v = pickLine(slot, mode, used);
  speakWhenFree(v.text, v.type, slotPriority(slot), waitMs);
}

/**
 * Post-answer reaction buttons: roast the answer's LOGIC, never the author.
 * Bundled into the same utterance as the read so one synth call carries one
 * full joke (no inter-call steal, no extra slam-cadence pressure).
 */
const REACTIONS = [
  "Explain yourself.",
  "Seriously? Say it with confidence.",
  "Bold. Wrong, but bold.",
  "Who hurt you?",
  "That is certainly an answer.",
  "Read that back to yourself. Out loud.",
  "Confident. Incorrect energy, but confident.",
  "Someone believed that while typing it?",
];

function pickReaction(used: Set<string>): string {
  const fresh = REACTIONS.filter((r) => !used.has(`react:${r}`));
  const pool = fresh.length ? fresh : REACTIONS;
  if (!fresh.length) for (const r of REACTIONS) used.delete(`react:${r}`);
  const text = pool[Math.floor(Math.random() * pool.length)];
  used.add(`react:${text}`);
  return text;
}

/**
 * Speak one revealed answer card: read verbatim (sanitized) + reaction
 * button in the SAME utterance. Drawings get a personality aside instead.
 * Priority 5: a new card preempts a pending one-liner, but never a phase
 * opener already talking.
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
  const reaction = pickReaction(used);
  return speak(`${prefix}${clean}... [beat] ${reaction}`, { type: "setup", priority: 5 });
}

/** Speak when the channel is free: polls isSpeaking instead of trusting
 * estimateMs (Kokoro WASM gen latency is seconds, not chars/sec). Gives up
 * after ~15s so a stuck channel can't backlog the game. */
function speakWhenFree(text: string, type: LineType, priority: number, waitMs = 0): void {
  const start = Date.now();
  const tick = () => {
    if (Date.now() - start > 15000) return;
    if (Date.now() - start < waitMs) {
      setTimeout(tick, 250);
      return;
    }
    if (isSpeaking()) {
      setTimeout(tick, 500);
      return;
    }
    speak(text, { type, priority });
  };
  setTimeout(tick, 250);
}

/** Score extras: shutout / unanimous, spoken after the winner line. Waits
 * for real channel silence (not estimateMs) so the sticky mic-drop can't
 * swallow them. */
export function scoreExtras(
  subs: SubmissionLike[],
  mode: SarcasmMode,
  used: Set<string>,
  leadMs = 3500,
): void {
  const queue = (text: string, type: LineType, extraWait: number) => {
    speakWhenFree(text, type, 4, leadMs + extraWait);
  };
  const shutout = subs.find((s) => (s.votes ?? 0) === 0);
  if (shutout && subs.length >= 2) {
    const v = pickLine("score_shutout", mode, used);
    queue(v.text, v.type, 0);
  }
  const top = subs.reduce<SubmissionLike | null>((b, s) => (!b || (s.votes ?? 0) > (b.votes ?? 0) ? s : b), null);
  if (top && (top.votes ?? 0) >= 2 && subs.length >= 3) {
    const v = pickLine("score_unanimous", mode, used);
    // Only call it unanimous-ish; the picker copy hedges honestly.
    queue(v.text, v.type, 4000);
  }
}

/**
 * Quiz REVEAL entry: sting + question in ONE utterance so the second half
 * can't steal the channel mid-sting (the old estimateMs chain cut the joke
 * whenever Kokoro gen lagged). Priority 10 like other phase openers.
 */
export function sayQuizQuestion(
  question: string | null,
  mode: SarcasmMode,
  used: Set<string>,
): boolean {
  const sting = pickLine("quiz_question", mode, used);
  const clean = sanitizeForSpeech(question);
  if (!clean) return speak(sting.text, { type: sting.type, priority: 10 });
  return speak(`${sting.text}... [beat] ${clean}`, { type: sting.type, priority: 10 });
}

/**
 * INPUT entry for text/draw/bluff: savage sting + challenge in ONE utterance.
 * Bluff-safe: the prompt is the QUESTION — the hidden truth row is never
 * spoken here (REVEAL walk teases it instead).
 */
export function sayInputPrompt(
  prompt: string | null,
  mode: SarcasmMode,
  used: Set<string>,
): boolean {
  const sting = pickLine("input_opener", mode, used);
  const clean = sanitizeForSpeech(prompt);
  if (!clean) return speak(sting.text, { type: sting.type, priority: 10 });
  return speak(`${sting.text}... [beat] ${clean}`, { type: sting.type, priority: 10 });
}

/**
 * INPUT stall jab that may name a slow typer. Names are sanitized +
 * truncated (16 chars max, same as join validation) so speech can't be
 * hijacked by a hostile display name.
 */
export function sayStall(
  mode: SarcasmMode,
  used: Set<string>,
  slowName?: string | null,
): boolean {
  const v = pickLine("input_stall", mode, used);
  if (!slowName) return speak(v.text, { type: v.type, priority: 1 });
  const clean = sanitizeForSpeech(slowName).slice(0, 16);
  if (!clean) return speak(v.text, { type: v.type, priority: 1 });
  return speak(`${v.text} ${clean}... are you writing a novel?`, { type: v.type, priority: 1 });
}

/**
 * Quiz SCORE reveal: verdict + answer in ONE utterance, waiting for real
 * channel silence behind the winner mic-drop (never collides, never cut).
 */
export function sayQuizAnswer(
  correctText: string | null,
  anyoneRight: boolean,
  mode: SarcasmMode,
  used: Set<string>,
  delayMs = 3500,
): boolean {
  const slot = anyoneRight ? "quiz_correct" : "quiz_nobody_right";
  const v = pickLine(slot, mode, used);
  const clean = sanitizeForSpeech(correctText);
  const line = clean ? `${v.text}... [beat] ${clean}` : v.text;
  speakWhenFree(line, v.type, 5, delayMs);
  return true;
}
