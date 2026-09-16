"use client";

// Saturday host voice engine — Tier 1: built-in browser speechSynthesis.
// No recordings, no API keys, no network. The TV speaks; phones stay silent.
// Personality copy lives in hostPersonality.ts, queue building in hostLines.ts.
// This file owns: prefs, prosody presets (smug trivia nerd), clause chunking
// for cadence beats, and a tiny priority queue with interrupt rules.
//
// Kokoro.js slot: implement the Engine interface with kokoro-js and pass it
// to setEngine() — call sites don't change. Beat markers ("...", " — ",
// "[beat]") map to silence tokens there.

import { isMuted } from "./sfx";

const VOICE_KEY = "saturday:voice"; // "1" = on, "0" = off. Default on.
const SARCASM_KEY = "saturday:sarcasm"; // "family" | "savage". Default family.

export type LineType = "setup" | "punchline" | "aside" | "roast" | "hype";

export type SpeakOpts = {
  type?: LineType;
  /** Higher wins. Phase openers 10, reveal cards 5, one-liners 1, winner 20. */
  priority?: number;
  /** Uninterruptible (SCORE winner). Even phase-cancel won't cut it. */
  sticky?: boolean;
};

// Smug trivia nerd: a touch fast, slightly low, punchlines slow down into
// condescension. Hype is reserved for winner lines so they land by contrast.
const PRESETS: Record<LineType, { rate: number; pitch: number; vol: number }> = {
  setup: { rate: 1.12, pitch: 0.9, vol: 1 },
  punchline: { rate: 0.95, pitch: 0.75, vol: 1 },
  aside: { rate: 1.22, pitch: 1.0, vol: 0.7 },
  roast: { rate: 1.05, pitch: 0.82, vol: 1 },
  hype: { rate: 1.0, pitch: 1.1, vol: 1 },
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

export type SarcasmMode = "family" | "savage";

export function getSarcasmMode(): SarcasmMode {
  try {
    return window.localStorage.getItem(SARCASM_KEY) === "savage" ? "savage" : "family";
  } catch {
    return "family";
  }
}

export function setSarcasmMode(mode: SarcasmMode): void {
  try {
    window.localStorage.setItem(SARCASM_KEY, mode);
  } catch {}
}

// --- Unlock ---------------------------------------------------------------
// speechSynthesis on desktop usually speaks without a gesture, but mobile
// Chrome gates it. The host page already has a "Tap for sound" gesture that
// unlocks WebAudio — call unlockVoice() there too so voice + SFX arm together.
let unlocked = false;

export function unlockVoice(): void {
  unlocked = true;
  // Warm the voice list; some browsers populate async.
  try {
    window.speechSynthesis?.getVoices();
  } catch {}
}

function gated(): boolean {
  if (typeof window === "undefined") return false;
  if (!unlocked) return false;
  if (!isVoiceEnabled()) return false;
  if (isMuted()) return false;
  if (!("speechSynthesis" in window)) return false;
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
// line into clause utterances with tuned gaps. "..." → 350ms, " — " → 220ms,
// "[beat]" → 450ms before the punchline clause.
type Chunk = { text: string; pauseAfter: number };

export function chunkLine(line: string): Chunk[] {
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
          if (out.length) out[out.length - 1].pauseAfter = Math.max(out[out.length - 1].pauseAfter, 350);
          else out.push({ text: "", pauseAfter: 350 });
        }
        return;
      }
      clauses.forEach((c, ci) => {
        let pause = 120; // base clause gap keeps the nerd clip
        if (ci < clauses.length - 1) pause = 220;
        if (di < dots.length - 1 && ci === clauses.length - 1) pause = 350;
        out.push({ text: c, pauseAfter: pause });
      });
    });
    if (bi < beats.length - 1 && out.length) {
      out[out.length - 1].pauseAfter = Math.max(out[out.length - 1].pauseAfter, 450);
    }
  });
  return out.filter((c) => c.text.length > 0);
}

// --- Priority queue ----------------------------------------------------------
let speechToken = 0;
let currentPriority = -Infinity;
let currentSticky = false;

function supported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Speak a line. Returns false if gated or preempted by higher priority. */
export function speak(line: string, opts: SpeakOpts = {}): boolean {
  if (!gated() || !supported()) return false;
  const text = line.replace(/\[beat\]/g, "").trim();
  if (!text) return false;
  const priority = opts.priority ?? 1;
  const sticky = opts.sticky ?? false;
  try {
    if (window.speechSynthesis.speaking || currentSticky) {
      if (priority < currentPriority || currentSticky) return false;
      window.speechSynthesis.cancel();
    }
  } catch {}
  const type = opts.type ?? "setup";
  const preset = PRESETS[type];
  const chunks = chunkLine(line);
  if (!chunks.length) return false;
  const token = ++speechToken;
  currentPriority = priority;
  currentSticky = sticky;
  const voice = pickVoice();
  let i = 0;
  const step = () => {
    if (token !== speechToken) return; // cancelled
    if (i >= chunks.length) {
      if (token === speechToken) {
        currentPriority = -Infinity;
        currentSticky = false;
      }
      return;
    }
    const chunk = chunks[i++];
    try {
      const u = new SpeechSynthesisUtterance(chunk.text);
      u.rate = preset.rate;
      u.pitch = preset.pitch;
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
  try {
    if (supported()) window.speechSynthesis.cancel();
  } catch {}
}

/** True while a voice line (or its beat gap) owns the channel. */
export function isSpeaking(): boolean {
  try {
    return supported() && (window.speechSynthesis.speaking || currentPriority > -Infinity);
  } catch {
    return false;
  }
}
