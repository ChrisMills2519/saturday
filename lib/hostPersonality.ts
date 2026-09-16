// Saturday host personality: smug trivia nerd who asks questions, never
// teaches the rules. Savage-only: one voice for the whole game.
// hostCopy.ts stays the baseline for on-screen text; this file owns what the
// VOICE says. Every line is interrogative (contains "?").
// Beat markers ("...", " — ", "[beat]") are rendered as pauses by
// lib/voice.ts chunkLine() — and map to silence tokens for Kokoro later.
//
// Target policy: roast answers + the room and slow behavior, may name slow
// typers by first name (sanitized, 16 chars max). Never punches identity.
// Shutout lines stay backhanded-kind — zero votes already hurts.
// Self-vote / device / timing rules live in tiny silent on-screen captions
// + API errors only, never in the voice.

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

const FAMILY: Record<Slot, string[]> = {
  lobby_cold_open: [
    "Saturday night... [beat] who showed up ready to lose with dignity?",
    "Welcome to Saturday... technically a trivia game... spiritually a mistake — who invited this group?",
  ],
  lobby_ready: [
    "Fun fact: you all showed up... [beat] but who here actually came to win?",
    "Enough humans... barely — so who's feeling brave already?",
  ],
  input_opener: [
    "Prompt's on the TV... [beat] so what have you got — comedy or confidence?",
    "Round's live... what would you write if you weren't overthinking it?",
  ],
  input_nudge: [
    "Who's still typing — genius or napper?",
    "Whose brain is buffering right now... and what's it loading?",
    "Short or long... [beat] which way are you going with this one?",
    "Who's stalling... and do they know I can see it?",
    "Stuck? [beat] Whose name are you borrowing brilliance from?",
  ],
  input_stall: [
    "Still waiting on a few masterpieces... whose magnum opus is it?",
    "Clock's ticking... [beat] what's cooking in there — masterpiece or typo?",
  ],
  extend_snark: [
    "Thirty more seconds... [beat] who's actually going to use them?",
    "Extra time... whose genius needed a deadline extension?",
  ],
  reveal_opener: [
    "Drumroll... [beat] ready to hear what this group calls funny?",
    "Answers are in... so whose is whose — any guesses?",
  ],
  reveal_drawing: [
    "Next... a drawing — what am I looking at here, art or accident?",
    "A visual entry... bold... [beat] but what was the artist thinking?",
  ],
  vote_opener: [
    "Ballots are live... [beat] which one actually deserves it?",
    "So many choices... which one would you steal credit for?",
  ],
  score_winner: [
    "Results... [beat] so who peaked tonight?",
    "Scores are in... whose victory lap is this?",
  ],
  score_shutout: [
    "Zero votes for that one... how does that even happen?",
    "No votes there... [beat] who else felt that sting before?",
  ],
  score_unanimous: [
    "A clean sweep... did you all plan that together?",
    "Unanimous... [beat] when has this room ever agreed on anything?",
  ],
  score_award: [
    "House awards... [beat] who earned a title nobody asked for?",
    "Bonus titles... whose consolation prize is this?",
  ],
  quiz_question: [
    "Trivia time... [beat] who's actually been paying attention?",
    "Question's up... so who here knows things?",
  ],
  quiz_correct: [
    "The answer was... did anyone actually know that?",
    "Correct answer's in... whose brain just earned its keep?",
  ],
  quiz_nobody_right: [
    "Nobody got it... how are we feeling about that?",
    "Zero correct... [beat] who else is rethinking everything?",
  ],
  quiz_bluff_sting: [
    "One of these is true... the rest are lies — whose nose is growing?",
    "Real answer hiding among fakes... can anyone smell the truth?",
  ],
};

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

// RETIRED 2026-09-16: FAMILY bank below is dead — voice is savage-only,
// one voice for the whole game (Emma). Kept in file to keep the diff small;
// bank() ignores mode and always deals savage.
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
