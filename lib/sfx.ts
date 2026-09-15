"use client";

// Saturday sound engine. Zero audio files: every effect is synthesized
// with WebAudio (oscillators + filtered noise + gain envelopes).
// Rules: AudioContext is created lazily inside a user gesture
// (mobile browsers start it suspended otherwise). All timers derive
// from the server-broadcast ends_at via useCountdown — SFX never
// causes network traffic. Mute persists in localStorage.

const MUTE_KEY = "saturday:muted";

let ctx: AudioContext | null = null;
let unlocked = false;

export function isMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMuted(m: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {}
}

/** Call inside a tap handler (Join / Start / any button). Idempotent. */
export function ensureAudio(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    unlocked = ctx.state === "running" || ctx.state === "suspended";
    return unlocked;
  } catch {
    return false;
  }
}

function ready(): boolean {
  return !!ctx && unlocked && !isMuted();
}

function tone(opts: {
  from: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  vol?: number;
  delay?: number;
}) {
  if (!ready() || !ctx) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.from, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + (opts.dur ?? 0.1));
  const v = opts.vol ?? 0.25;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + (opts.dur ?? 0.1));
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + (opts.dur ?? 0.1) + 0.05);
}

function noise(opts: { dur?: number; vol?: number; delay?: number; highpass?: number }) {
  if (!ready() || !ctx) return;
  const t0 = ctx.currentTime + (opts.delay ?? 0);
  const dur = opts.dur ?? 0.2;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  const v = opts.vol ?? 0.2;
  g.gain.setValueAtTime(v, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node: AudioNode = src;
  if (opts.highpass) {
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = opts.highpass;
    node.connect(f);
    node = f;
  }
  node.connect(g).connect(ctx.destination);
  src.start(t0);
}

/** Countdown tick. pitch rises as secondsLeft drops to 0. */
export function tick(secondsLeft: number): void {
  const f = 660 + Math.max(0, 5 - secondsLeft) * 60;
  tone({ from: f, dur: 0.06, type: "square", vol: 0.12 });
}

/** Hard cut at 0s: descending buzz + crash. */
export function timesUp(): void {
  tone({ from: 220, to: 55, dur: 0.5, type: "sawtooth", vol: 0.3 });
  noise({ dur: 0.4, vol: 0.25, highpass: 800 });
}

/** Reveal card entrance sting. */
export function revealSting(): void {
  for (let i = 0; i < 8; i++) noise({ dur: 0.05, vol: 0.08 + i * 0.015, delay: i * 0.07, highpass: 2000 });
  tone({ from: 523, dur: 0.3, type: "triangle", vol: 0.25, delay: 0.6 });
  tone({ from: 784, dur: 0.4, type: "triangle", vol: 0.25, delay: 0.68 });
}

/** Single vote lock-in pop. */
export function votePop(): void {
  tone({ from: 500, to: 900, dur: 0.08, type: "sine", vol: 0.25 });
}

/** Submit confirmation blip. */
export function submitBlip(): void {
  tone({ from: 600, to: 880, dur: 0.09, type: "triangle", vol: 0.2 });
}

/** Score fanfare: C-E-G-C arpeggio + cheer noise. */
export function fanfare(): void {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => tone({ from: n, dur: 0.28, type: "triangle", vol: 0.25, delay: i * 0.13 }));
  noise({ dur: 0.9, vol: 0.1, delay: 0.4, highpass: 1200 });
}

/** Short join chime for lobby entrances. */
export function joinChime(): void {
  tone({ from: 880, to: 1175, dur: 0.12, type: "sine", vol: 0.18 });
}

/** Synth lobby loop: I–vi–IV–V pad + hat ticks. Code-only fallback
 *  when /audio/lobby.mp3 is absent. Returns a stop function. */
export function startLobbyLoop(): () => void {
  if (!ready() || !ctx) return () => {};
  const chords = [
    [261.6, 329.6, 392.0], // C
    [220.0, 261.6, 329.6], // Am
    [174.6, 220.0, 261.6], // F
    [196.0, 246.9, 293.7], // G
  ];
  let step = 0;
  let stopped = false;
  const id = setInterval(() => {
    if (stopped || !ready() || !ctx) return;
    const chord = chords[step % chords.length];
    chord.forEach((f) => tone({ from: f, dur: 0.9, type: "triangle", vol: 0.06 }));
    noise({ dur: 0.04, vol: 0.03, highpass: 6000 });
    noise({ dur: 0.04, vol: 0.03, delay: 0.5, highpass: 6000 });
    step++;
  }, 1000);
  return () => {
    stopped = true;
    clearInterval(id);
  };
}

export function buzz(): void {
  navigator.vibrate?.(20);
}
