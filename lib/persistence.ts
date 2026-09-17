// Reload-resilience helpers. A phone browser can be killed anytime
// (network switch, tab reclaim, camera round-trip). Join state + answer
// drafts live in localStorage so a refresh returns the player to the game,
// not the join form, with their typing intact.

export type StoredJoin = { name: string; at: number };

const joinKey = (code: string) => `saturday:join:${code.toUpperCase()}`;
const draftKey = (code: string, round: number) =>
  `saturday:draft:${code.toUpperCase()}:${round}`;

function safeGet(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
}

function safeDel(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {}
}

export function loadJoin(code: string): StoredJoin | null {
  const raw = safeGet(joinKey(code));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredJoin;
    return parsed?.name ? parsed : null;
  } catch {
    return null;
  }
}

export function saveJoin(code: string, name: string): void {
  safeSet(joinKey(code), JSON.stringify({ name, at: Date.now() }));
}

export function loadDraft(code: string, round: number): string {
  return safeGet(draftKey(code, round)) ?? "";
}

export function saveDraft(code: string, round: number, text: string): void {
  if (!text) safeDel(draftKey(code, round));
  else safeSet(draftKey(code, round), text);
}

export function clearDraft(code: string, round: number): void {
  safeDel(draftKey(code, round));
}

const voteKey = (code: string, round: number) =>
  `saturday:voted:${code.toUpperCase()}:${round}`;

export function loadVoted(code: string, round: number): string | null {
  return safeGet(voteKey(code, round));
}

export function saveVoted(code: string, round: number, target: string): void {
  safeSet(voteKey(code, round), target);
}

export function clearVoted(code: string, round: number): void {
  safeDel(voteKey(code, round));
}

/** Rematch resets rounds to 0 — drop stale vote flags so a new game's R1
 * never renders "Vote locked in" from the previous game. */
export function clearAllVoted(code: string, maxRounds = 12): void {
  const prefix = `saturday:voted:${code.toUpperCase()}:`;
  try {
    if (typeof window === "undefined") return;
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) doomed.push(k);
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
  } catch {}
  for (let r = 0; r <= maxRounds; r++) safeDel(voteKey(code, r));
}
