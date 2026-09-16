"use client";

// Saturday voice profile — the tunable delivery layer.
// The Voice Lab (/voicelab) edits a VoiceProfile (Kokoro voice id, per-line-
// type gen speeds, pause-gap ms) and saves it to localStorage; the engine
// (lib/voice.ts chunkLine + lib/voiceKokoro.ts gen) reads it at call time.
// "Save to game" in the lab == applyVoiceProfile() — what you heard is
// exactly what the host page speaks. No build step, no secrets, no server.
//
// Import/export is plain JSON: paste a friend's profile to audition it.
// Everything is sanitized + clamped on load/import so a hostile or corrupt
// blob can't break the game (falls back to DEFAULT_PROFILE values).

import type { LineType } from "./voice";

export const VOICE_PROFILE_KEY = "saturday:voiceProfile:v1";
export const PROFILE_VERSION = 1;

export const LINE_TYPES: LineType[] = ["setup", "punchline", "aside", "roast", "hype"];

// Voices shipped with kokoro-js v1.2.1 (first two letters = accent+gender:
// af/am American, bf/bm British). Cheap to extend — the ~92MB model is
// shared per-origin in Cache Storage; only the voice tensor loads per id.
export const VOICE_CHOICES = [
  { id: "bf_emma", label: "Emma — British, warm (as shipped)" },
  { id: "bm_fable", label: "Fable — British, storyteller" },
  { id: "bm_george", label: "George — British, posh gravitas" },
  { id: "bm_daniel", label: "Daniel — British, deadpan" },
  { id: "af_bella", label: "Bella — American, bright" },
  { id: "af_nicole", label: "Nicole — American, soft" },
  { id: "af_heart", label: "Heart — American, energetic" },
  { id: "am_michael", label: "Michael — American, newsy" },
  { id: "am_adam", label: "Adam — American, deep" },
  { id: "am_onyx", label: "Onyx — American, deep + slow" },
] as const;

export type LineSpeeds = Record<LineType, number>;

export type VoiceProfile = {
  version: typeof PROFILE_VERSION;
  /** Kokoro voice id (see VOICE_CHOICES; unknown ids still honored). */
  voice: string;
  /** Gen speed per line type, clamped 0.5–2.0 (1 = model default). */
  speeds: LineSpeeds;
  /** Base clause gap ms (keeps the clip between comma-ish chunks). */
  pauseClause: number;
  /** " — " dash gap ms (the condescension gap). */
  pauseDash: number;
  /** "..." ellipsis gap ms (the dramatic one). */
  pauseDots: number;
  /** "[beat]" hard stop gap ms (the punchline setup). */
  pauseBeat: number;
  /** Optional Tier-1 fallback rate/pitch override; null = engine presets. */
  tier1: { rate: number; pitch: number } | null;
};

export const DEFAULT_PROFILE: VoiceProfile = {
  version: PROFILE_VERSION,
  voice: "bf_emma",
  speeds: { setup: 1.0, punchline: 0.92, aside: 1.08, roast: 1.0, hype: 1.05 },
  pauseClause: 120,
  pauseDash: 220,
  pauseDots: 350,
  pauseBeat: 450,
  tier1: null,
};

function freshDefault(): VoiceProfile {
  return { ...DEFAULT_PROFILE, speeds: { ...DEFAULT_PROFILE.speeds }, tier1: null };
}

/** Short display name for a voice id ("Emma"); unknown ids pass through. */
export function voiceLabel(id: string): string {
  const hit = VOICE_CHOICES.find((v) => v.id === id);
  return hit ? hit.label.split(" — ")[0] : id;
}

// --- Live getter --------------------------------------------------------------
// The Voice Lab auditions DRAFTS without committing them: it parks the draft
// here (setVoiceProfileOverride) and clears it on unmount, so dragging a
// slider is audible instantly. The game itself never sets this — it reads the
// saved profile from localStorage, which "Save to game" writes.
let override: VoiceProfile | null = null;

export function setVoiceProfileOverride(p: VoiceProfile | null): void {
  override = p;
}

/** Read by every engine call site (chunkLine gaps, Kokoro voice/speeds). */
export function getVoiceProfile(): VoiceProfile {
  return override ?? loadVoiceProfile();
}

function clamp(n: unknown, lo: number, hi: number): number | null {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null;
}

/** Never trusts input: clamps every field, fills gaps with defaults. */
export function sanitizeVoiceProfile(raw: unknown): VoiceProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const speedsRaw = (r.speeds ?? {}) as Record<string, unknown>;
  const speeds = {} as LineSpeeds;
  for (const t of LINE_TYPES) speeds[t] = clamp(speedsRaw[t], 0.5, 2) ?? DEFAULT_PROFILE.speeds[t];
  const voice =
    typeof r.voice === "string" && /^[a-z]{2}_[a-z]{2,20}$/.test(r.voice)
      ? r.voice
      : DEFAULT_PROFILE.voice;
  const t1 = r.tier1 as Record<string, unknown> | null | undefined;
  const tier1 =
    t1 && typeof t1 === "object"
      ? { rate: clamp(t1.rate, 0.1, 2) ?? 1.05, pitch: clamp(t1.pitch, 0, 2) ?? 0.95 }
      : null;
  return {
    version: PROFILE_VERSION,
    voice,
    speeds,
    pauseClause: clamp(r.pauseClause, 0, 1500) ?? DEFAULT_PROFILE.pauseClause,
    pauseDash: clamp(r.pauseDash, 0, 2000) ?? DEFAULT_PROFILE.pauseDash,
    pauseDots: clamp(r.pauseDots, 0, 2500) ?? DEFAULT_PROFILE.pauseDots,
    pauseBeat: clamp(r.pauseBeat, 0, 3000) ?? DEFAULT_PROFILE.pauseBeat,
    tier1,
  };
}

export function loadVoiceProfile(): VoiceProfile {
  try {
    if (typeof window === "undefined") return freshDefault();
    const raw = window.localStorage.getItem(VOICE_PROFILE_KEY);
    if (!raw) return freshDefault();
    return sanitizeVoiceProfile(JSON.parse(raw)) ?? freshDefault();
  } catch {
    return freshDefault();
  }
}

export function saveVoiceProfile(p: VoiceProfile): void {
  try {
    window.localStorage.setItem(VOICE_PROFILE_KEY, JSON.stringify(p));
  } catch {}
}

/** True when a profile is stored (the game is already tuned, not as-shipped). */
export function hasSavedVoiceProfile(): boolean {
  try {
    return !!window.localStorage.getItem(VOICE_PROFILE_KEY);
  } catch {
    return false;
  }
}

/** Pretty JSON block for copy/download. */
export function exportVoiceProfile(p: VoiceProfile): string {
  return JSON.stringify({ ...p, version: PROFILE_VERSION }, null, 2);
}

/** Parses pasted JSON; throws short friendly errors for the lab to show. */
export function importVoiceProfile(json: string): VoiceProfile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("That's not JSON — paste the exported block as-is.");
  }
  const p = sanitizeVoiceProfile(parsed);
  if (!p) throw new Error("Missing or malformed profile fields.");
  return p;
}

/**
 * Live-apply: persist + clear Kokoro's buffer cache (cache keys embed the
 * old voice/speed, so stale audio must go). Fire-and-forget import keeps
 * this safe before/without the Kokoro module ever loading.
 */
export function applyVoiceProfile(p: VoiceProfile): void {
  saveVoiceProfile(p);
  try {
    void import("./voiceKokoro")
      .then((m) => m.clearKokoroCache())
      .catch(() => {});
  } catch {}
}

/** Back to Emma as shipped (also re-applies immediately). */
export function resetVoiceProfile(): VoiceProfile {
  const p = freshDefault();
  applyVoiceProfile(p);
  return p;
}
