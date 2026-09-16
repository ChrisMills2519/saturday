"use client";

// Saturday host voice engine — Kokoro.js neural default, Tier 1 fallback.
// Full swap: Kokoro (q8 WASM, ~92MB, lazy-loaded on the TV only) speaks once
// warmed; built-in speechSynthesis covers the warmup window + any load/gen
// failure so the game never goes mute. Phones stay silent.
// Personality copy lives in hostPersonality.ts, queue building in hostLines.ts.
// This file owns: prefs, prosody presets (smug trivia nerd), clause chunking
// for cadence beats, and a priority queue with interrupt rules + FIFO for
// equal-priority cards (REVEAL walk) + drop-before-gen for p1 nudges.
// Beat markers ("...", " — ", "[beat]") become chunk gaps here and silence
// gaps in lib/voiceKokoro.ts. Call sites don't change.

import { isMuted } from "./sfx";
import { getVoiceProfile, type VoiceProfile } from "./voiceProfile";

const VOICE_KEY = "saturday:voice"; // "1" = on, "0" = off. Default on.
const KOKORO_KEY = "saturday:kokoro"; // "1" = try Kokoro, "0" = Tier 1 only. Default on (full swap).

export type LineType = "setup" | "punchline" | "aside" | "roast" | "hype";

export type SpeakOpts = {
  type?: LineType;
  /** Higher wins. Phase openers 10, reveal cards 5, one-liners 1, winner 20. */
  priority?: number;
  /** Uninterruptible (SCORE winner). Even phase-cancel won't cut it. */
  sticky?: boolean;
};

// Savage Emma: contrast without caricature. Punchline dips (not dives) so
// backhanded jokes keep their rise; aside stays audible; hype lifts.
// (Tier-1 fallback only — Kokoro path uses speed + punctuation instead.)
const PRESETS: Record<LineType, { rate: number; pitch: number; vol: number }> = {
  setup: { rate: 1.05, pitch: 0.95, vol: 1 },
  punchline: { rate: 1.0, pitch: 0.9, vol: 1 },
  aside: { rate: 1.1, pitch: 1.0, vol: 0.85 },
  roast: { rate: 1.0, pitch: 0.9, vol: 1 },
  hype: { rate: 1.05, pitch: 1.1, vol: 1 },
};

export function isVoiceEnabled(): boolean {
  try {
    return window.localStorage.getItem(VOICE_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setVoiceEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(VOICE_KEY, on ? "1" : "0");
  } catch {}
  if (!on) cancelVoice();
}

/** Savage-only: single voice for the whole game. Kept as a type so call
 * sites don't churn; family bank is gone (see hostPersonality). */
export type SarcasmMode = "savage";

export function getSarcasmMode(): SarcasmMode {
  return "savage";
}

export function setSarcasmMode(): void {}

/** Full-swap rollback: "0" pins Tier 1; env NEXT_PUBLIC_VOICE=tier1 same. */
export function isKokoroEnabled(): boolean {
  try {
    if (
      typeof process !== "undefined" &&
      (process as { env?: Record<string, string | undefined> }).env?.NEXT_PUBLIC_VOICE === "tier1"
    )
      return false;
  } catch {}
  try {
    return window.localStorage.getItem(KOKORO_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setKokoroEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(KOKORO_KEY, on ? "1" : "0");
  } catch {}
  if (!on) cancelVoice();
  else unlockVoice(); // re-arm: kicks warmup if needed
}

// --- Unlock ---------------------------------------------------------------
// The host page's "Tap for sound" gesture arms WebAudio + voice together.
// Kokoro warmup also starts here (lazy dynamic import — never in the server
// bundle, never on phones) so the ~92MB first download happens in LOBBY.
let unlocked = false;
let warmupKicked = false;

export function unlockVoice(): void {
  unlocked = true;
  // Warm the Tier 1 voice list; some browsers populate async.
  try {
    window.speechSynthesis?.getVoices();
  } catch {}
  if (!warmupKicked && isKokoroEnabled()) {
    warmupKicked = true;
    void import("./voiceKokoro")
      .then((m) =>
        m.warmupKokoro().then(() => {
          kokoroIsReady = true;
        }),
      )
      .catch(() => {});
  }
}

/** Fire-and-forget pre-gen (REVEAL cards, openers). No-op until Kokoro ready. */
export function pregenVoice(lines: { text: string; type: LineType }[]): void {
  if (!isKokoroEnabled() || !lines.length) return;
  void import("./voiceKokoro")
    .then((m) => m.pregenerateKokoro(lines))
    .catch(() => {});
}

export function kokoroReady(): boolean {
  return kokoroIsReady;
}

// --- Voice profile ------------------------------------------------------------
// The Voice Lab (/voicelab) owns delivery: Kokoro voice + per-line-type
// speeds live in voiceKokoro, pause gaps live in chunkLine below. Both read
// the same saved profile at call time — what you auditioned is what plays.
// Re-exported here so call sites (host page, lab) import from one place.
export {
  getVoiceProfile,
  applyVoiceProfile,
  resetVoiceProfile,
  exportVoiceProfile,
  importVoiceProfile,
  saveVoiceProfile,
  hasSavedVoiceProfile,
  voiceLabel,
} from "./voiceProfile";
export type { VoiceProfile } from "./voiceProfile";

function gated(): boolean {
  if (typeof window === "undefined") return false;
  if (!unlocked) return false;
  if (!isVoiceEnabled()) return false;
  if (isMuted()) return false;
  return true;
}

// --- Voice pick ------------------------------------------------------------
let cachedVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice;
  cachedVoice = null;
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
    const pool = en.length ? en : voices;
    // Prefer a natural US voice; Google US English reads smug best.
    const prefs = ["google us english", "microsoft aria", "microsoft jenny", "samantha", "daniel", "google uk english male"];
    for (const p of prefs) {
      const hit = pool.find((v) => v.name.toLowerCase().includes(p));
      if (hit) {
        cachedVoice = hit;
        return hit;
      }
    }
    cachedVoice = pool.find((v) => v.lang.toLowerCase() === "en-us") ?? pool[0] ?? null;
  } catch {
    cachedVoice = null;
  }
  return cachedVoice;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  try {
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoice = undefined;
      pickVoice();
    };
  } catch {}
}

// --- Clause chunker ---------------------------------------------------------
// speechSynthesis ignores SSML, so cadence comes from structure: split the
// line into clause utterances with tuned gaps. Gap values come from the
// voice profile (Voice Lab sliders): "..." → pauseDots, " — " → pauseDash,
// "[beat]" → pauseBeat before the punchline clause, clause base → pauseClause.
type Chunk = { text: string; pauseAfter: number };

export function chunkLine(line: string): Chunk[] {
  const prof: VoiceProfile = getVoiceProfile();
  const out: Chunk[] = [];
  // [beat] is a hard pause marker, not spoken.
  const beats = line.split("[beat]");
  beats.forEach((segment, bi) => {
    // Ellipses pause inside a segment.
    const dots = segment.split(/\.\.\.+/);
    dots.forEach((d, di) => {
      // Em-dash splits into clipped condescending clauses.
      const clauses = d.split(/\s+[—–-]\s+|\s+—\s+/).map((c) => c.trim()).filter(Boolean);
      if (!clauses.length) {
        if (di < dots.length - 1) {
          if (out.length) out[out.length - 1].pauseAfter = Math.max(out[out.length - 1].pauseAfter, prof.pauseDots);
          else out.push({ text: "", pauseAfter: prof.pauseDots });
        }
        return;
      }
      clauses.forEach((c, ci) => {
        let pause = prof.pauseClause;
        if (ci < clauses.length - 1) pause = prof.pauseDash;
        if (di < dots.length - 1 && ci === clauses.length - 1) pause = prof.pauseDots;
        out.push({ text: c, pauseAfter: pause });
      });
    });
    if (bi < beats.length - 1 && out.length) {
      out[out.length - 1].pauseAfter = Math.max(out[out.length - 1].pauseAfter, prof.pauseBeat);
    }
  });
  return out.filter((c) => c.text.length > 0);
}

// --- Priority queue ----------------------------------------------------------
// Rules: higher preempts (cancel + steal); lower drops BEFORE any gen work
// (p1 nudges never burn WASM cycles under an opener); equal priority at
// card level (<=5) queues FIFO instead of thrashing (REVEAL walk); sticky
// SCORE winner drops everything until cancelled.
let speechToken = 0;
let currentPriority = -Infinity;
let currentSticky = false;
let kokoroIsReady = false;
let kokoroPlaying = false;
type PendingJob = { line: string; opts: SpeakOpts };
let fifo: PendingJob[] = [];

function supported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function tier1Active(): boolean {
  try {
    return supported() && window.speechSynthesis.speaking;
  } catch {
    return false;
  }
}

function channelBusy(): boolean {
  return tier1Active() || kokoroPlaying || currentPriority > -Infinity;
}

/** Speak a line. Returns false if gated or preempted by higher priority. */
export function speak(line: string, opts: SpeakOpts = {}): boolean {
  if (!gated()) return false;
  const text = line.replace(/\[beat\]/g, "").trim();
  if (!text) return false;
  const priority = opts.priority ?? 1;
  const sticky = opts.sticky ?? false;
  if (channelBusy() || currentSticky) {
    if (priority < currentPriority || currentSticky) return false; // drop before gen
    if (priority === currentPriority && priority <= 5 && !sticky) {
      if (fifo.length < 12) fifo.push({ line, opts }); // FIFO, never thrash
      return true;
    }
    cancelVoice();
  }
  const type = opts.type ?? "setup";
  const token = ++speechToken;
  currentPriority = priority;
  currentSticky = sticky;
  // Full swap: Kokoro once warmed, Tier 1 during warmup / on opt-out.
  if (isKokoroEnabled() && kokoroIsReady) {
    void runKokoro(line, type, token);
    return true;
  }
  if (isKokoroEnabled() && !warmupKicked) unlockVoice();
  return runTier1(line, type, token);
}

async function runKokoro(line: string, type: LineType, token: number): Promise<void> {
  let mod: typeof import("./voiceKokoro") | null = null;
  try {
    mod = await import("./voiceKokoro");
  } catch {
    mod = null;
  }
  if (token !== speechToken || !mod) {
    if (token === speechToken) finish(token);
    else pumpFifo();
    return;
  }
  try {
    if (mod.isKokoroReady()) kokoroIsReady = true;
  } catch {}
  kokoroPlaying = true;
  let spoke = false;
  try {
    spoke = await mod.playKokoroLine(line, type, () => token !== speechToken);
  } catch {
    spoke = false;
  }
  kokoroPlaying = false;
  if (token !== speechToken) {
    pumpFifo();
    return;
  }
  if (!spoke) {
    // Kokoro produced nothing audible: Tier 1 for this line so the game
    // never goes mute (warmup window, locked AudioContext, gen fail).
    runTier1(line, type, token);
    return;
  }
  finish(token);
  pumpFifo();
}

function pumpFifo(): void {
  if (currentPriority > -Infinity || currentSticky) return;
  const next = fifo.shift();
  if (!next) return;
  speak(next.line, next.opts);
}

function finish(token: number): void {
  if (token === speechToken) {
    currentPriority = -Infinity;
    currentSticky = false;
  }
}

function runTier1(line: string, type: LineType, token: number): boolean {
  if (!supported()) {
    finish(token);
    return false;
  }
  const preset = PRESETS[type];
  // Profile override (Voice Lab "Apply to fallback voice too"): shifts the
  // Tier-1 rate toward the setup speed + clamps pitch, so a tuned delivery
  // roughly survives the fallback. null = stock engine presets.
  const override = getVoiceProfile().tier1;
  const rate = override ? preset.rate * (override.rate / 1.05) : preset.rate;
  const pitch = override ? Math.min(2, Math.max(0, preset.pitch * (override.pitch / 0.95))) : preset.pitch;
  const chunks = chunkLine(line);
  if (!chunks.length) {
    finish(token);
    return false;
  }
  const voice = pickVoice();
  let i = 0;
  const step = () => {
    if (token !== speechToken) return; // cancelled
    if (i >= chunks.length) {
      finish(token);
      pumpFifo();
      return;
    }
    const chunk = chunks[i++];
    try {
      const u = new SpeechSynthesisUtterance(chunk.text);
      u.rate = rate;
      u.pitch = pitch;
      u.volume = preset.vol;
      if (voice) u.voice = voice;
      u.onend = () => {
        if (token !== speechToken) return;
        setTimeout(step, chunk.pauseAfter);
      };
      u.onerror = () => {
        if (token === speechToken) {
          currentPriority = -Infinity;
          currentSticky = false;
        }
      };
      window.speechSynthesis.speak(u);
    } catch {
      if (token === speechToken) {
        currentPriority = -Infinity;
        currentSticky = false;
      }
    }
  };
  step();
  return true;
}

/** Cancel everything (phase change, mute off, advance). Sticky loses too. */
export function cancelVoice(): void {
  speechToken++;
  currentPriority = -Infinity;
  currentSticky = false;
  kokoroPlaying = false;
  fifo = [];
  try {
    if (supported()) window.speechSynthesis.cancel();
  } catch {}
  // Best-effort neural stop (module may not be loaded — then nothing plays).
  try {
    void import("./voiceKokoro")
      .then((m) => m.cancelKokoro())
      .catch(() => {});
  } catch {}
}

/** True while a voice line (or its beat gap) owns the channel. */
export function isSpeaking(): boolean {
  if (currentPriority > -Infinity || currentSticky) return true;
  try {
    if (kokoroPlaying) return true;
    if (supported() && window.speechSynthesis.speaking) return true;
  } catch {}
  return false;
}
