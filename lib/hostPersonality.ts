// Saturday host personality: savage Emma, one voice for the whole game.
// Smug trivia nerd who performs, never announces. hostCopy.ts stays the
// baseline for on-screen text; this file owns what the VOICE says.
// Questions where funny, declaratives where announcing — no 100% `?` rule
// (it forced status updates into question drag + fed the ?→... flattener).
// The voice MAY teach rules, but only as jokes (one funny how-to per phase
// max); silent captions stay as backup, not sole teacher.
// Beat markers ("...", " — ", "[beat]") are rendered as pauses by
// lib/voice.ts chunkLine() — and map to silence tokens for Kokoro later.
//
// Target policy: roast answer-logic hard, name slow typers by first name
// (sanitized, 16 chars max), sting shutouts once then comfort — zero votes
// already hurts, so one jab max.
// Self-vote / device / timing rules live in tiny silent on-screen captions
// + API errors too, but the voice may riff on them once as a joke.

import type { SarcasmMode, LineType } from "./voice";

export type VoiceLine = { text: string; type: LineType };

export type Slot =
  | "lobby_cold_open"
  | "lobby_ready"
  | "input_opener"
  | "input_nudge"
  | "input_stall" // someone is slow — behavior jab only, savage only names no one
  | "extend_snark"
  | "reveal_opener"
  | "reveal_drawing"
  | "vote_opener"
  | "score_winner"
  | "score_shutout" // an answer got 0 votes — gentle in both modes
  | "score_unanimous"
  | "score_award"
  | "quiz_question" // sting before the question is read (classic + bluff REVEAL)
  | "quiz_correct" // someone nailed it — before the answer is read
  | "quiz_nobody_right" // zero correct picks — gentle, knowledge is hard
  | "quiz_bluff_sting"; // tease instead of reading the hidden truth aloud

const SAVAGE: Record<Slot, string[]> = {
  lobby_cold_open: [
    "Saturday night... [beat] who lowered their standards to be here?",
    "Welcome back... I lowered my expectations in advance — who plans to prove me right?",
  ],
  lobby_ready: [
    "Oh good, enough people... so whose fault will it be when this goes sideways?",
    "Two players... each voting for the other out of pity — whose charity case is this?",
  ],
  input_opener: [
    "Prompt's live... read it twice, I know that's a big ask — but what have you got?",
    "Pressure's on... so whose funny is actually going to show up?",
  ],
  input_nudge: [
    "Still typing? The prompt was one sentence... what's taking so long?",
    "The greats answer in seconds... the goods in minutes — which group is this?",
    "Typing... deleting... typing... whose masterpiece keeps escaping?",
    "If your answer needs this long... what exactly is it curing?",
  ],
  input_stall: [
    "Waiting on a masterpiece, apparently... in a timed game — whose is it?",
    "Someone's still typing... in a timed game — what could possibly be worth it?",
  ],
  extend_snark: [
    "Oh, you need MORE time? Shocking... whose genius works on extension?",
    "Extra time... did the prompt get harder, or did whose brain stall?",
  ],
  reveal_opener: [
    "Answers locked... anonymous for their own protection — whose needs it most?",
    "Drumroll... some of these have confidence... [beat] but whose is misplaced?",
  ],
  reveal_drawing: [
    "Next... a drawing — fridge-worthy, or... whose toddler did this?",
    "A visual... hmm... [beat] which one of you is calling THAT art?",
  ],
  vote_opener: [
    "Ballots are live — choosing between these... whose headache is your favorite?",
    "So many options... [beat] which one sucks the least?",
  ],
  score_winner: [
    "Winner crowned... [beat] who saw that coming — honestly?",
    "Champion decided... whose applause is loudest — all three claps?",
  ],
  score_shutout: [
    "Zero votes... not one pity vote — whose heart just broke a little?",
    "That answer got no votes... bold... avant-garde — but whose was it?",
  ],
  score_unanimous: [
    "Everyone backed the same answer... even the author couldn't — so whose miracle is this?",
    "Clean sweep... the room agreed for once — whose date do we mark?",
  ],
  score_award: [
    "House awards — for those who couldn't win properly... whose consolation is this?",
    "Consolation titles... points weren't humiliating enough — whose name is next?",
  ],
  quiz_question: [
    "Trivia... finally something facts can win — whose memory is showing up?",
    "Question's live... easy one, allegedly — who's about to embarrass themselves?",
  ],
  quiz_correct: [
    "Answer revealed... did anyone get it, or was that collective guessing?",
    "There it is... whose lucky guess just paid off?",
  ],
  quiz_nobody_right: [
    "Nobody... not one correct — whose education failed hardest?",
    "Zero right... impressive, honestly — whose confidence survived?",
  ],
  quiz_bluff_sting: [
    "One truth, rest fiction... this group lies how well?",
    "Spot the truth among the lies... whose poker face is worst?",
  ],
};

// Voice is savage-only, one voice for the whole game (Emma). The mode param
// stays so call sites don't churn; it is intentionally ignored.
function bank(_mode: SarcasmMode): Record<Slot, string[]> {
  return SAVAGE;
}

const LINE_TYPE: Record<Slot, LineType> = {
  lobby_cold_open: "setup",
  lobby_ready: "punchline",
  input_opener: "setup",
  input_nudge: "aside",
  input_stall: "roast",
  extend_snark: "roast",
  reveal_opener: "setup",
  reveal_drawing: "aside",
  vote_opener: "setup",
  score_winner: "hype",
  score_shutout: "punchline",
  score_unanimous: "hype",
  score_award: "aside",
  quiz_question: "setup",
  quiz_correct: "punchline",
  quiz_nobody_right: "punchline",
  quiz_bluff_sting: "setup",
};

/**
 * Pick a line for a slot. Pass a per-game used-set to avoid repeats; the
 * picker prefers unseen lines and resets only when the bank is exhausted.
 * Pure + seeded-friendly for tests.
 */
export function pickLine(slot: Slot, mode: SarcasmMode, used?: Set<string>): VoiceLine {
  const lines = bank(mode)[slot] ?? SAVAGE[slot];
  const type = LINE_TYPE[slot] ?? "setup";
  if (!used) return { text: lines[Math.floor(Math.random() * lines.length)], type };
  const fresh = lines.filter((l) => !used.has(`${slot}:${l}`));
  const pool = fresh.length ? fresh : lines;
  if (!fresh.length) {
    // Bank exhausted: clear this slot's marks and deal fresh.
    for (const l of lines) used.delete(`${slot}:${l}`);
  }
  const text = pool[Math.floor(Math.random() * pool.length)];
  used.add(`${slot}:${text}`);
  return { text, type };
}
