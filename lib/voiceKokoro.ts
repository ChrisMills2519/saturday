"use client";

// Saturday neural voice — Kokoro.js (82M params, q8 WASM, ~92MB).
// Lazy-loaded ONLY on the TV after a user gesture; phones never import it.
// Model weights download once from HF Hub/CDN, then transformers.js serves
// them from the Cache Storage API (`transformers-cache`, per-origin).
// Playback shares the sfx AudioContext so mute/unlock stay single-source.
// Beat markers are cadence gaps (sleep), not synthesized silence.
//
// Call sites never touch this file directly — lib/voice.ts owns the
// priority queue + prefs and delegates here when Kokoro is ready.

import { ensureAudio, getAudioContext } from "./sfx";
import { chunkLine, type LineType } from "./voice";

export const KOKORO_MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
export const KOKORO_VOICES = ["bm_fable", "bf_emma"] as const;
export type KokoroVoiceId = (typeof KOKORO_VOICES)[number];

const KOKORO_VOICE_KEY = "saturday:kokoro-voice"; // "bm_fable" | "bf_emma"

export function getKokoroVoice(): KokoroVoiceId {
  try {
    const v = window.localStorage.getItem(KOKORO_VOICE_KEY);
    if (v === "bf_emma") return "bf_emma";
  } catch {}
  return "bm_fable";
}

export function setKokoroVoice(v: KokoroVoiceId): void {
  try {
    window.localStorage.setItem(KOKORO_VOICE_KEY, v);
  } catch {}
}

// Smug trivia nerd, neural edition: Kokoro has no pitch knob, only speed
// (+ speaker choice). Question-only copy (?) gets a natural rise from the
// model — force a declarative fall on mic-drop hype only (score_winner /
// score_unanimous) so the winner lands. Punchline keeps its lift: the
// shutout/ready jokes need the rise to read backhanded, not sincere.
const SPEED: Record<LineType, number> = {
  setup: 1.05,
  punchline: 0.85,
  aside: 1.2,
  roast: 1.0,
  hype: 0.95,
};

function prosodyText(text: string, type: LineType): string {
  const t = text.trim();
  if (!t) return t;
  if (type === "hype") {
    // Terminal fall: "who peaked tonight?" -> "who peaked tonight..."
    if (/\?\s*$/.test(t)) return t.replace(/\?\s*$/, "...");
  }
  return t;
}

// --- Loader (singleton) ------------------------------------------------------

type KokoroTTS = {
  generate: (text: string, opts?: { voice?: string; speed?: number }) => Promise<unknown>;
  list_voices?: () => unknown;
};

let tts: KokoroTTS | null = null;
let loadPromise: Promise<void> | null = null;
let ready = false;
let loadError: string | null = null;
let progress = 0; // 0..1 model download

// jsdelivr serves the self-contained browser bundle PLUS its sibling
// runtime assets (ort.bundle.min.mjs, ort wasm) from the same dir, so
// relative resolution works in the browser. webpackIgnore keeps the
// bundler from following this (it would choke on the .wasm, and the TV
// is the only client that ever fetches it — phones never warm up).
const KOKORO_CDN =
  "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js";

async function loadKokoroModule(): Promise<{
  KokoroTTS: {
    from_pretrained: (
      model: string,
      opts?: Record<string, unknown>,
    ) => Promise<KokoroTTS>;
  };
}> {
  return (await import(/* webpackIgnore: true */ KOKORO_CDN)) as {
    KokoroTTS: {
      from_pretrained: (
        model: string,
        opts?: Record<string, unknown>,
      ) => Promise<KokoroTTS>;
    };
  };
}

export function isKokoroReady(): boolean {
  return ready && !!tts;
}

export function kokoroProgress(): number {
  return progress;
}

export function kokoroError(): string | null {
  return loadError;
}

/** Idempotent. onProgress gets 0..1 during the ~92MB first download. */
export function warmupKokoro(onProgress?: (p: number) => void): Promise<void> {
  if (ready) {
    onProgress?.(1);
    return Promise.resolve();
  }
  if (loadPromise) {
    if (onProgress) {
      const id = setInterval(() => {
        onProgress(progress);
        if (ready || loadError) clearInterval(id);
      }, 250);
    }
    return loadPromise;
  }
  loadPromise = (async () => {
    try {
      const { KokoroTTS } = await loadKokoroModule();
      tts = await KokoroTTS.from_pretrained(KOKORO_MODEL, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (ev: unknown) => {
          try {
            // transformers.js reports progress 0–100 (not 0–1), and when the
            // CDN omits Content-Length every event reads exactly 100 with
            // total tracking loaded. Only trust intermediate values; hold
            // the last real one otherwise instead of faking instant 100%.
            const e = ev as { loaded?: number; total?: number; progress?: number };
            if (typeof e.progress === "number" && e.progress > 0 && e.progress < 100) {
              progress = e.progress / 100;
            } else if (e.loaded != null && e.total && e.loaded < e.total) {
              progress = e.loaded / e.total;
            } else {
              return;
            }
            progress = Math.max(0, Math.min(1, progress));
            onProgress?.(progress);
          } catch {}
        },
      });
      ready = true;
      progress = 1;
      onProgress?.(1);
    } catch (e) {
      loadError = e instanceof Error ? e.message : "kokoro load failed";
      throw e;
    }
  })();
  return loadPromise;
}

// --- PCM extraction (defensive across kokoro-js versions) ---------------------

function extractPcm(res: unknown): { pcm: Float32Array; rate: number } | null {
  try {
    const r = res as Record<string, unknown>;
    const cands = [r.audio, r.data, r.samples, r.waveform, r.buffer, r.pcm];
    let pcm: Float32Array | null = null;
    for (const c of cands) {
      if (c instanceof Float32Array) {
        pcm = c;
        break;
      }
      if (Array.isArray(c) && c.length && typeof c[0] === "number") {
        pcm = Float32Array.from(c as number[]);
        break;
      }
      if (c instanceof ArrayBuffer) {
        pcm = new Float32Array(c);
        break;
      }
    }
    // RawAudio-style { data: Float32Array, sampling_rate }
    if (!pcm && r.data && typeof r.data === "object") {
      const d = (r.data as Record<string, unknown>).data;
      if (d instanceof Float32Array) pcm = d;
    }
    if (!pcm) return null;
    const rate =
      (typeof r.sampling_rate === "number" && r.sampling_rate) ||
      (typeof r.sampleRate === "number" && r.sampleRate) ||
      24000;
    return { pcm, rate };
  } catch {
    return null;
  }
}

// --- Gen cache (per voice+speed+text) ------------------------------------------

const bufCache = new Map<string, AudioBuffer>();

function cacheKey(voice: string, speed: number, text: string): string {
  return `${voice}:${speed}:${text}`;
}

async function genChunk(
  text: string,
  type: LineType,
  voice: string,
): Promise<AudioBuffer | null> {
  if (!tts) return null;
  const speed = SPEED[type] ?? 1;
  const key = cacheKey(voice, speed, text);
  const hit = bufCache.get(key);
  if (hit) return hit;
  const spoken = prosodyText(text, type);
  if (!spoken) return null;
  let res: unknown;
  try {
    res = await tts.generate(spoken, { voice, speed });
  } catch {
    return null;
  }
  const pcm = extractPcm(res);
  if (!pcm || pcm.pcm.length === 0) return null;
  const ctx = getAudioContext();
  if (!ctx) return null;
  try {
    // Decode at the model's rate; the context resamples on playback.
    const buf = ctx.createBuffer(1, pcm.pcm.length, pcm.rate);
    buf.getChannelData(0).set(pcm.pcm);
    if (bufCache.size > 120) {
      const first = bufCache.keys().next().value;
      if (first) bufCache.delete(first);
    }
    bufCache.set(key, buf);
    return buf;
  } catch {
    return null;
  }
}

/** Fire-and-forget pre-gen (REVEAL cards, openers). Sequential: WASM contention. */
export function pregenerateKokoro(lines: { text: string; type: LineType }[]): void {
  if (!tts || !ready) return;
  if (!lines.length) return;
  const voice = getKokoroVoice();
  void (async () => {
    for (const l of lines) {
      const chunks = chunkLine(l.text);
      for (const c of chunks) {
        if (!c.text) continue;
        const key = cacheKey(voice, SPEED[l.type] ?? 1, prosodyText(c.text, l.type));
        if (bufCache.has(key)) continue;
        try {
          await genChunk(c.text, l.type, voice);
        } catch {}
      }
    }
  })();
}

// --- Playback -------------------------------------------------------------------

let currentSource: AudioBufferSourceNode | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function playBuffer(buf: AudioBuffer): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      currentSource = src;
      src.onended = () => {
        if (currentSource === src) currentSource = null;
        resolve();
      };
      src.start();
    } catch {
      resolve();
    }
  });
}

/**
 * Play one line through Kokoro. Resolves when done OR cancelled.
 * shouldCancel is polled between chunks (gen + playback + gaps).
 */
export async function playKokoroLine(
  line: string,
  type: LineType,
  shouldCancel: () => boolean,
): Promise<void> {
  if (!tts || !ready) return;
  if (!ensureAudio()) return;
  const voice = getKokoroVoice();
  const chunks = chunkLine(line);
  if (!chunks.length) return;
  for (const c of chunks) {
    if (shouldCancel()) return;
    if (!c.text) {
      await sleep(c.pauseAfter);
      continue;
    }
    const buf = await genChunk(c.text, type, voice);
    if (shouldCancel()) return;
    if (!buf) return; // gen failed: drop (Tier 1 fallback owns retry policy)
    await playBuffer(buf);
    if (shouldCancel()) return;
    if (c.pauseAfter > 0) await sleep(c.pauseAfter);
  }
}

/** Stop current neural audio (phase change, mute, takeover). */
export function cancelKokoro(): void {
  try {
    currentSource?.stop();
  } catch {}
  currentSource = null;
}
