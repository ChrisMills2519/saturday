// Family-safe validation + dedupe + formatting.
// Server + client share these helpers so errors are consistent.

export const NAME_MAX = 16;
export const ANSWER_MAX = 140;

// Strong words match anywhere in the string (catches "Shitface", "Fuckery").
// Mild words match whole words only (avoids the Scunthorpe problem on honest words).
const STRONG = ["fuck", "shit", "bitch", "bastard", "cunt", "dick", "cock", "pussy", "slut", "whore", "nigger", "nigga", "faggot", "retard", "rape", "kys"];
const MILD = ["ass", "arse", "damn", "hell", "crap", "piss", "boobs", "penis", "sex"];

// Control/invisible chars out, whitespace collapsed, length capped.
// Plain regexes only: tsconfig targets ES5, so no `u` flag / \p{...} escapes.
function stripControl(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\ufeff]/g, "");
}

export function sanitizeName(raw: string): string {
  return stripControl(raw.replace(/\s+/g, " ").trim()).slice(0, NAME_MAX);
}

export function sanitizeText(raw: string, max = ANSWER_MAX): string {
  return stripControl(raw.replace(/\s+/g, " ").trim()).slice(0, max);
}

export function containsProfanity(s: string): boolean {
  const t = s.toLowerCase();
  if (STRONG.some((w) => t.includes(w))) return true;
  return MILD.some((w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`, "i").test(` ${t} `));
}

export function rejectReasonForName(name: string): string | null {
  const s = sanitizeName(name);
  if (!s) return "pick a name";
  if (s.length < 2) return "name too short";
  if (/^\d+$/.test(s)) return "name can't be only numbers";
  if (containsProfanity(s)) return "family-friendly names only";
  return null;
}

export function rejectReasonForAnswer(text: string | null, imageUrl: string | null): string | null {
  // Both channels are checked: a drawing never excuses profane text_content.
  const t = sanitizeText(text ?? "");
  if (t) {
    if (t.length < 2) return "answer too short";
    if (containsProfanity(t)) return "family-friendly answers only";
    return null;
  }
  if (imageUrl) return null;
  return "answer required";
}

const SESSION_RE = /^[A-Za-z0-9-]{1,64}$/;

/** Player session ids must be plain tokens — never house `quiz:*` rows. */
export function rejectReasonForSession(sessionId: unknown): string | null {
  if (typeof sessionId !== "string" || !sessionId) return "session_id required";
  if (sessionId.startsWith("quiz:")) return "reserved session";
  if (!SESSION_RE.test(sessionId)) return "bad session_id";
  return null;
}

const IMAGE_RE = /^(data:image\/(png|jpeg|webp);base64,|https?:\/\/)/i;

/** Drawings must be image data-URLs or http(s) URLs — never arbitrary strings. */
export function rejectReasonForImageUrl(imageUrl: unknown): string | null {
  if (imageUrl == null) return null;
  if (typeof imageUrl !== "string" || !IMAGE_RE.test(imageUrl.trim())) return "bad drawing";
  return null;
}

export function dedupeName(desired: string, taken: Set<string>): string {
  const base = sanitizeName(desired) || "Player";
  const lower = new Set(Array.from(taken).map((s) => s.toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  for (let n = 2; n <= 20; n++) {
    const cand = `${base.slice(0, NAME_MAX - String(n).length - 3)} (${n})`;
    if (!lower.has(cand.toLowerCase())) return cand;
  }
  // fallback: truncate + random
  const tag = String(Math.floor(Math.random() * 900) + 100);
  return `${base.slice(0, NAME_MAX - tag.length - 1)} ${tag}`;
}
