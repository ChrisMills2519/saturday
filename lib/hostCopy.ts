// Saturday announcer copy. The voice does half the work: every phase
// gets a title card + subline + host instruction, plus rotating
// one-liners to cover dead air during INPUT. Family-safe snark,
// second person, jokes first and rules second. No emoji — icons
// in components/icons.tsx carry the visual weight.

export const COLD_OPEN = "Saturday Night. Zero dignity required.";

export const LOBBY_TITLE = "Get in here!";
export const LOBBY_SUB = "Join on your phone. First round starts when the host says so.";
export const LOBBY_EMPTY = "Nobody yet. Shout the code across the room.";
export function lobbyReady(n: number): string {
  if (n < 3) return `${n} in — grab one more human to make voting work.`;
  return `${n} humans, 1 TV. Everybody in? Start!`;
}

export function roundTitle(round: number): string {
  if (round <= 1) return "Round 1 — warm up those brains";
  if (round === 2) return "Round 2 — no mercy";
  return `Round ${round} — final glory`;
}

export const INPUT_SUB = "Write fast. Worst answer still gets points for confidence.";
export const INPUT_DONE_ALL = "Everyone's in!";

export const INPUT_ONELINERS = [
  "Someone is typing… or napping. Fifty-fifty.",
  "No Googling. Your brain is funnier. Probably.",
  "Short answers win. This is not a novel.",
  "The host can see you stalling.",
  "Confidence beats comedy. Mostly.",
  "If stuck, blame Dad. It always lands.",
];

export function inputNudge(submitted: number, total: number): string {
  if (submitted >= total && total > 0) return INPUT_DONE_ALL;
  return `${submitted}/${total} locked in…`;
}

export const REVEAL_TITLE = "Drumroll…";
export const REVEAL_SUB = "Host: read them LOUD. Authors stay anonymous.";
export const REVEAL_ANON = "anonymous… for now";

export const VOTE_TITLE = "Vote on your phones!";
export const VOTE_SUB = "Pick your favorite. No voting for yourself, cheaters.";
export const VOTE_BLIND = "blind vote";
export function voteProgress(voted: number, total: number): string {
  return `${voted}/${total} voted — tallies hidden until scores…`;
}
export const VOTE_SOLO = "Only your answer is in — you can't vote for yourself. Grab another player, or get the host to skip to scores.";
export const VOTE_NEED_MORE = "Need 2+ answers to vote (solo players can't vote for themselves) — invite more phones or skip to scores.";

export const SCORE_TITLE = "Results!";
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

export const JOINED_LOBBY_TITLE = "You're in!";
export const JOINED_LOBBY_SUB = "Look at the TV — the round starts soon.";
export const SUBMITTED_TITLE = "You're in! Relax";
export const REVEAL_LOOKUP_TITLE = "Look up!";
export const REVEAL_LOOKUP_SUB = "Answers are on the TV. Voting opens next.";
export const VOTED_TITLE = "Locked in — no take-backs. Results on TV soon.";
export const VOTE_EMPTY_TITLE = "Nothing to vote on yet";
export const SUBMIT_LATE = "Too late — round moved on!";
export const ALREADY_VOTED = "Vote already locked in";
