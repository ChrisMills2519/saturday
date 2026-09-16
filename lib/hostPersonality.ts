// Saturday host personality: smug trivia nerd, family-safe by default.
// Two banks over the same slots. hostCopy.ts stays the family baseline for
// on-screen text; this file owns what the VOICE says, including the savage
// bank. Beat markers ("...", " — ", "[beat]") are rendered as pauses by
// lib/voice.ts chunkLine() — and map to silence tokens for Kokoro later.
//
// Target policy (load-bearing): roast answers + the room, never the person.
// Family mode never names slow typers. Savage may jab at behavior ("still
// typing... in a timed game") but never at identity. Shutout lines stay
// backhanded-kind in both modes — zero votes already hurts.

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
  | "score_award";

const FAMILY: Record<Slot, string[]> = {
  lobby_cold_open: [
    "Saturday night... [beat] zero dignity required.",
    "Welcome to Saturday. Technically... a trivia game. Spiritually... a mistake.",
  ],
  lobby_ready: [
    "Fun fact: you all showed up. [beat] The bar was on the floor, and yet — well done.",
    "Enough humans. Actually... barely enough. I'll take it.",
  ],
  input_opener: [
    "Round's on the TV. Read it... [beat] then write something better than you'd expect from this group.",
    "Prompt's up. Fun fact: confidence beats comedy. Mostly. Write fast.",
  ],
  input_nudge: [
    "Someone is typing... or napping. Fifty-fifty, honestly.",
    "No Googling. Your brain is funnier. Probably. Low bar, but still.",
    "Short answers win. This is not a novel. Looking at... everyone.",
    "The host can see you stalling. The host is judging. Lovingly.",
    "If stuck — blame Dad. It always lands. Fun fact.",
  ],
  input_stall: [
    "Still waiting on a few masterpieces. Take your time... it's only a timed game.",
    "Technically, the clock is real. Just FYI. For the... still typing.",
  ],
  extend_snark: [
    "Thirty more seconds. Use them... wisely. Or don't. I'm not your coach.",
    "Extra time granted. Fun fact: the greats never needed it. Anyway.",
  ],
  reveal_opener: [
    "Drumroll... [beat] authors stay anonymous. Cowards. All of you. Let's read.",
    "Answers are in. Some of these are... choices. Host: read them LOUD.",
  ],
  reveal_drawing: [
    "Next... a drawing. Interpret that how you will. I have questions.",
    "A visual entry. Bold. [beat] Confusing, but bold.",
  ],
  vote_opener: [
    "Vote on your phones. Pick your favorite... [beat] no voting for yourself, cheaters. I check.",
    "Ballots open. Choose wisely. Or don't — chaos is also content.",
  ],
  score_winner: [
    "Results. [beat] Someone in this room peaked tonight.",
    "Scores are final. Well — final-ish. I don't do recounts.",
  ],
  score_shutout: [
    "Zero votes for that one. Bold strategy. The room has... spoken. Softly.",
    "No votes there. It happens to the best. And... to this one.",
  ],
  score_unanimous: [
    "A clean sweep. Everyone picked the same answer. [beat] Terrifying unity, honestly.",
    "Unanimous. Fun fact: that almost never happens. Enjoy your moment.",
  ],
  score_award: [
    "House awards. Meaningless competitively... [beat] memorable socially.",
    "Bonus titles, because points clearly weren't enough validation.",
  ],
};

const SAVAGE: Record<Slot, string[]> = {
  lobby_cold_open: [
    "Saturday night. Zero dignity required... [beat] and looking at this lobby, zero dignity expected.",
    "Welcome back. I lowered my expectations in advance. Smartest thing I've done all week.",
  ],
  lobby_ready: [
    "Oh good, enough people that I can't blame low turnout for how this goes.",
    "Two players. Each votes for the other... [beat] riveting format. Get a third human next time.",
  ],
  input_opener: [
    "Prompt's on the TV. Read it twice — I know that's a big ask... [beat] then write.",
    "Write something funny. I know, I know — pressure. You'll manage. Probably not, but try.",
  ],
  input_nudge: [
    "Still typing? The prompt wasn't a riddle. It was one sentence.",
    "Fun fact: the greats answer in seconds. The goods answer in minutes. Guess which group this is.",
    "Typing... deleting... typing. Just commit. Mediocrity loves confidence.",
    "If your answer needs this long, it better cure something.",
  ],
  input_stall: [
    "We're waiting on a masterpiece, apparently. In a timed party game. Sure.",
    "Someone's still typing... in a timed game. Take your time. The clock is decorative anyway.",
  ],
  extend_snark: [
    "Oh, you need MORE time? Shocking. Thirty seconds. Spend them... thinking. First time for everything.",
    "Extra time granted. The prompt didn't get harder while you waited, just FYI.",
  ],
  reveal_opener: [
    "Answers locked. Authors anonymous... [beat] for their own protection, frankly. Let's read.",
    "Drumroll. Some of these answers have... [beat] confidence. Misplaced, but confidence.",
  ],
  reveal_drawing: [
    "Next... a drawing. I've seen better. On fridges. From toddlers. Anyway — vote.",
    "A visual. Hmm. [beat] You know what, sure. Art is subjective. This is... subjective.",
  ],
  vote_opener: [
    "Vote. Pick the best one — I know, choosing between these is like choosing a favorite headache.",
    "Ballots open. No voting for yourself. I know it's tempting when it's your only good option.",
  ],
  score_winner: [
    "Winner crowned. [beat] Try to act surprised. You all saw the votes.",
    "Champion decided. Accept your applause... all three claps of it.",
  ],
  score_shutout: [
    "Zero votes. Not one pity vote. [beat] The room has spoken... by saying nothing.",
    "That answer got no votes. Bold. Avant-garde. Unloved. Anyway.",
  ],
  score_unanimous: [
    "Everyone voted for the same answer. Even the author's... well, they couldn't. But still. A miracle.",
    "Clean sweep. The room agreed on something for once. Mark the date.",
  ],
  score_award: [
    "House awards — for those who couldn't win properly. Kidding... [beat] mostly.",
    "Consolation titles. Because points weren't humiliating enough on their own.",
  ],
};

function bank(mode: SarcasmMode): Record<Slot, string[]> {
  return mode === "savage" ? SAVAGE : FAMILY;
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
};

/**
 * Pick a line for a slot. Pass a per-game used-set to avoid repeats; the
 * picker prefers unseen lines and resets only when the bank is exhausted.
 * Pure + seeded-friendly for tests.
 */
export function pickLine(slot: Slot, mode: SarcasmMode, used?: Set<string>): VoiceLine {
  const lines = bank(mode)[slot] ?? FAMILY[slot];
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
