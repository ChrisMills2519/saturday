// Saturday announcer copy. The voice asks the questions: every phase
// gets a title card + question subline, plus rotating questions
// to cover dead air during INPUT. Family-safe snark,
// second person, questions first and never instructions. No emoji — icons
// in components/icons.tsx carry the visual weight. Rules live in tiny
// silent captions + API errors only (e.g. no self-vote).

export const COLD_OPEN = "Saturday Night. Zero dignity required.";

export const LOBBY_TITLE = "Who's in?";
export const LOBBY_SUB = "Who's joining this round?";
export const LOBBY_EMPTY = "Who's first?";
export function lobbyReady(n: number): string {
  if (n === 2) return "Two in — whose rivalry is this?";
  if (n < 3) return `${n} in — who's bringing one more human?`;
  return `${n} humans, 1 TV. Who's ready?`;
}

export function roundTitle(round: number): string {
  if (round <= 1) return "Round 1 — warm up those brains";
  if (round === 2) return "Round 2 — no mercy";
  return `Round ${round} — final glory`;
}

export const INPUT_SUB = "What have you got?";
export const INPUT_DONE_ALL = "Everyone's in — whose is best?";

export const INPUT_ONELINERS = [
  "Who's still typing — genius or napper?",
  "Whose brain is buffering right now?",
  "Which way are you going — short or novel?",
  "Who's stalling... and do they know?",
  "Whose brilliance are you borrowing?",
  "What's cooking in there?",
];

export function inputNudge(submitted: number, total: number): string {
  if (submitted >= total && total > 0) return INPUT_DONE_ALL;
  return `${submitted}/${total} locked in…`;
}

export const REVEAL_TITLE = "Drumroll… whose is whose?";
export const REVEAL_SUB = "Whose is whose?";
export const REVEAL_ANON = "whose, for now?";

export const VOTE_TITLE = "Which one?";
export const VOTE_SUB = "Which one deserves it? (not your own)";
export const VOTE_BLIND = "whose leads?";
export function voteProgress(voted: number, total: number): string {
  return `${voted}/${total} voted — whose is leading?`;
}
export const VOTE_SOLO = "Only yours is in — whose else would you pick? Add a player, or skip to scores.";
export const VOTE_NEED_MORE = "Whose answers are missing? Need 2+ to vote (not your own) — add phones or skip to scores.";

export const SCORE_TITLE = "Results!";
export function roundOf(cur: number, total: number): string {
  return `Round ${Math.max(cur, 1)} of ${total}`;
}
export function isFinalRound(cur: number, total: number): boolean {
  return cur >= total;
}
export function roundWinnerLine(answer: string, name: string, votes: number): string {
  const safe = answer.length > 60 ? `${answer.slice(0, 57)}…` : answer;
  return `${votes} ${votes === 1 ? "vote" : "votes"} · “${safe}”`;
}
export function nextRoundLine(round: number, total: number): string {
  if (round >= total) return "That was the last round — final standings above.";
  if (round + 1 >= total) return `Next: Round ${round + 1} of ${total} — FINAL ROUND, points are doubled!`;
  return `Next: Round ${round + 1} of ${total} — scores carry over.`;
}
export const MVP_TITLE = "Round winner";
export const EXTEND_LABEL = "+30 seconds";
export const SKIP_LABEL = "Skip ahead";
export const HOST_HINT = "Who's reading this one?";
export const REVEAL_HINT = "Whose is next? Tap for it.";
export function drawingLabel(): string {
  return "drawing";
}
export const FINAL_TITLE = "Final results!";
export const FINAL_SUB = "Champion crowned. Rematch, or quit while you're behind.";
export const AWARDS_TITLE = "House awards";
export function awardCrowdFavorite(name: string): string {
  return `Crowd favorite: ${name} — the room has spoken.`;
}
export function awardDarkHorse(name: string): string {
  return `Dark horse: ${name} — one brave vote. Respect.`;
}
export function awardNovelist(name: string): string {
  return `Novelist: ${name} — used every last character.`;
}
export function awardMinimalist(name: string): string {
  return `Minimalist: ${name} — said it in the fewest words.`;
}
export const REMATCH_LABEL = "Rematch (same code)";
export const ONE_MORE_LABEL = "One more round";
export function winnerLine(name: string): string {
  return `Winner: ${name}!`;
}
export const SCORE_EMPTY = "No votes yet — play a round!";
export function youWinLine(): string {
  return "You win!";
}
export function personalLine(name: string, pts: number): string {
  return `${name} wins! — you have ${pts}`;
}

export const JOINED_LOBBY_TITLE = "You're in — who's next?";
export const JOINED_LOBBY_SUB = "Who else is joining?";
export const SUBMITTED_TITLE = "Locked in — was that your best?";
export const REVEAL_LOOKUP_TITLE = "Whose is whose?";
export const REVEAL_LOOKUP_SUB = "Which one would you pick?";
export const VOTED_TITLE = "Locked in — which one did you pick?";
export const VOTE_EMPTY_TITLE = "Whose answers are missing?";
export const SUBMIT_LATE = "Too late — round moved on!";
export const ALREADY_VOTED = "Vote already locked in";
