"use client";

// Saturday Voice Lab (/voicelab) — the host-side tuning desk for the TV voice.
//
// Personality lives in three places: the words (lib/hostPersonality.ts), the
// voice + gen speed (lib/voiceKokoro.ts), and the cadence gaps between clauses
// (lib/voice.ts chunkLine). This page edits the last two as one tuneable
// profile (lib/voiceProfile.ts), auditions it against preset statements, and
// exports a JSON block you can paste into any TV browser.
//
// How the knobs map to what you hear:
//   voice      — a different character entirely (cheapest, biggest lever)
//   speeds     — Kokoro has NO pitch knob: speed is the only delivery control,
//                so per-line-type contrast IS the personality
//   pause*     — the silences: " — " = condescension gap, "..." = dramatic
//                drop, "[beat]" = punchline setup
//
// Drafts never touch the game until "Save to game": sliders park a draft in an
// in-memory override (setVoiceProfileOverride) that the engine prefers while
// this tab is open, and clearing on unmount. Save/export happen explicitly.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_PROFILE,
  LINE_TYPES,
  VOICE_CHOICES,
  applyVoiceProfile,
  exportVoiceProfile,
  hasSavedVoiceProfile,
  importVoiceProfile,
  loadVoiceProfile,
  resetVoiceProfile,
  setVoiceProfileOverride,
  voiceLabel,
  type VoiceProfile,
} from "@/lib/voiceProfile";
import {
  cancelVoice,
  isKokoroEnabled,
  isVoiceEnabled,
  kokoroReady,
  setKokoroEnabled,
  setVoiceEnabled,
  speak,
  unlockVoice,
  type LineType,
} from "@/lib/voice";
import { ensureAudio, isMuted, setMuted } from "@/lib/sfx";

// --- Copy --------------------------------------------------------------------
const LINE_HELP: Record<LineType, string> = {
  setup: "Asks the question — the neutral baseline. 1.00 is the model default.",
  punchline: "Lands the joke. Below 1.00 draws it out and reads smug.",
  aside: "Tossed-off mutter. Above 1.00 sounds like you can't be bothered.",
  roast: "Backhanded reaction to an answer. Flat/even reads deadpan.",
  hype: "Mic-drop lift — winner lines. Above 1.00 pushes the energy.",
};

const PRESET_LINES: Record<LineType, string> = {
  setup: "So you had a whole minute... [beat] and this is what came out?",
  punchline: "Points for confidence... [beat] — and absolutely nothing for accuracy.",
  aside: "I'd explain the joke — but it's funnier if you sit with it.",
  roast: "That is certainly an answer... someone believed that while typing it?",
  hype: "And the winner is... [beat] — the one person who actually read the question!",
};

const DEFAULT_LINE =
  "Number three... [beat] the secret family recipe is a microwave — which is why nobody lets you cook.";

const PAUSE_KNOBS: {
  key: "pauseClause" | "pauseDash" | "pauseDots" | "pauseBeat";
  label: string;
  help: string;
  max: number;
}[] = [
  { key: "pauseClause", label: "Clause gap", help: "Between comma-ish chunks.", max: 400 },
  { key: "pauseDash", label: "Dash gap ( — )", help: "The condescension pause.", max: 800 },
  { key: "pauseDots", label: "Ellipsis gap ( ... )", help: "The dramatic drop.", max: 1200 },
  { key: "pauseBeat", label: "Beat gap ( [beat] )", help: "The punchline setup.", max: 1500 },
];

// --- Slider ------------------------------------------------------------------
function Slider({
  label,
  help,
  value,
  min,
  max,
  step,
  suffix = "",
  onChange,
}: {
  label: string;
  help?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (n: number) => void;
}) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 15, fontWeight: 700 }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums", color: "#c4b5fd" }}>
          {suffix === "×" ? value.toFixed(2) : Math.round(value)}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#7c3aed" }}
      />
      {help && <small style={{ opacity: 0.6, display: "block", lineHeight: 1.4 }}>{help}</small>}
    </label>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section style={section}>
      <h2 style={h2}>{title}</h2>
      {note && <p style={note_}>{note}</p>}
      {children}
    </section>
  );
}

// --- Page --------------------------------------------------------------------
export default function VoiceLabPage() {
  // SSR-safe: start from the shipped defaults, load localStorage after mount.
  const [draft, setDraft] = useState<VoiceProfile>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState<VoiceProfile>(DEFAULT_PROFILE);
  const [line, setLine] = useState(DEFAULT_LINE);
  const [lineType, setLineType] = useState<LineType>("setup");
  const [status, setStatus] = useState("");
  const [muted, setMutedState] = useState(false);
  const [armed, setArmed] = useState(false);
  const [kokoroOn, setKokoroOnState] = useState(true);
  const [pct, setPct] = useState(0);
  const [ready, setReady] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  // Slider drags fire fast; only evict gen buffers when the voice actually changes.
  const lastVoice = useRef(DEFAULT_PROFILE.voice);

  // Hydrate from storage + report the audio gate state.
  useEffect(() => {
    const p = loadVoiceProfile();
    setDraft(p);
    setSaved(p);
    lastVoice.current = p.voice;
    setMutedState(isMuted());
    setKokoroOnState(isKokoroEnabled());
    setStatus(
      hasSavedVoiceProfile()
        ? `Loaded your saved profile — ${voiceLabel(p.voice)}. The game already plays this.`
        : `Started from the shipped default — ${voiceLabel(p.voice)} as-is.`,
    );
    // The host voice can be toggled off on the TV; a tuning page that can't
    // make a sound is useless, so flip it back on and say so.
    if (!isVoiceEnabled()) {
      setVoiceEnabled(true);
      setStatus("Host voice was switched off on this browser — turned it on so you can hear the lab.");
    }
  }, []);

  // Audition the draft live, without committing it to the game.
  useEffect(() => {
    setVoiceProfileOverride(draft);
    if (lastVoice.current !== draft.voice) {
      lastVoice.current = draft.voice;
      void import("@/lib/voiceKokoro")
        .then((m) => m.clearKokoroCache())
        .catch(() => {});
    }
  }, [draft]);

  // Leaving the lab restores the saved profile for anything else in this tab.
  useEffect(() => () => setVoiceProfileOverride(null), []);

  // Neural warmup status (the ~92MB model is cached per-origin after run one).
  useEffect(() => {
    if (ready) return;
    const id = setInterval(() => {
      void import("@/lib/voiceKokoro")
        .then((m) => {
          setPct(m.kokoroProgress());
          if (m.isKokoroReady()) {
            setReady(true);
            clearInterval(id);
          }
        })
        .catch(() => {});
    }, 500);
    return () => clearInterval(id);
  }, [ready]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const json = useMemo(() => exportVoiceProfile(draft), [draft]);

  function patch(next: Partial<VoiceProfile>) {
    setDraft((d) => ({ ...d, ...next }));
  }

  function patchSpeed(t: LineType, n: number) {
    setDraft((d) => ({ ...d, speeds: { ...d.speeds, [t]: n } }));
  }

  function setPause(key: "pauseClause" | "pauseDash" | "pauseDots" | "pauseBeat", n: number) {
    setDraft((d) => {
      switch (key) {
        case "pauseClause":
          return { ...d, pauseClause: n };
        case "pauseDash":
          return { ...d, pauseDash: n };
        case "pauseDots":
          return { ...d, pauseDots: n };
        default:
          return { ...d, pauseBeat: n };
      }
    });
  }

  const audition = useCallback((p: VoiceProfile, text: string, type: LineType) => {
    const clean = text.trim();
    if (!clean) return;
    setVoiceProfileOverride(p); // hear exactly the profile passed in
    ensureAudio();
    setArmed(true);
    unlockVoice();
    cancelVoice();
    speak(clean, { type, priority: 10 });
    const engine = kokoroReady() ? voiceLabel(p.voice) : "the built-in fallback (neural voice still warming)";
    setStatus(`${type} @ ${p.speeds[type].toFixed(2)}× — ${engine}. First take of a new line pays the gen cost; repeats are instant.`);
  }, []);

  function play() {
    if (isMuted()) {
      setMuted(false);
      setMutedState(false);
      ensureAudio();
    }
    audition(draft, line, lineType);
  }

  async function warmUp() {
    ensureAudio();
    setArmed(true);
    unlockVoice();
    if (!kokoroOn) {
      setKokoroEnabled(true);
      setKokoroOnState(true);
    }
    try {
      const m = await import("@/lib/voiceKokoro");
      setStatus("Downloading the voice model (~92MB — cached after the first time)…");
      await m.warmupKokoro((p) => setPct(p));
      setReady(m.isKokoroReady());
      setStatus(`Neural voice ready — ${voiceLabel(draft.voice)} can speak now.`);
    } catch {
      setStatus("Neural voice failed to load — the built-in fallback still plays (voice pick has no effect on it).");
    }
  }

  function save() {
    applyVoiceProfile(draft);
    setSaved(draft);
    setStatus(`Saved — the game plays ${voiceLabel(draft.voice)} from the next line on. Export the JSON to move it to another TV.`);
  }

  function reset() {
    const p = resetVoiceProfile(); // also re-applies immediately
    setDraft(p);
    setSaved(p);
    lastVoice.current = p.voice;
    setStatus("Back to Emma as shipped.");
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(json);
      setStatus("Profile JSON copied — paste it on the TV browser and hit Load.");
    } catch {
      setStatus("Copy blocked by the browser — select the JSON box and copy it by hand.");
    }
  }

  function downloadJson() {
    try {
      const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `saturday-voice-${draft.voice}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus("Downloaded — drop it in the repo or keep it beside the game.");
    } catch {
      setStatus("Download failed — copy the JSON box instead.");
    }
  }

  function importJson() {
    setImportErr(null);
    try {
      const p = importVoiceProfile(importText);
      setDraft(p);
      setStatus(`Loaded ${voiceLabel(p.voice)} into the lab — audition it, then Save to game.`);
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : "Couldn't read that profile.");
    }
  }

  return (
    <main style={page}>
      <div style={inner}>
        <p style={kicker}>TV only · nothing here touches Supabase</p>
        <h1 style={title}>Voice Lab</h1>
        <p style={sub}>
          Tune how the host talks, hear it on a preset statement, then export the profile. This page runs on the
          host laptop, not on phones, and never talks to the room.
        </p>
        <div style={row}>
          <a href="/" style={linkBtn}>
            ← Home
          </a>
          <button onClick={warmUp} style={primaryBtn} aria-label="Warm up the neural voice">
            {ready ? "Neural voice ready" : pct > 0 ? `Warming… ${Math.round(pct * 100)}%` : "Warm up neural voice"}
          </button>
          <button onClick={play} style={primaryBtn} aria-label="Audition the current line">
            ▶ Audition
          </button>
          {!ready && (
            <span style={pill}>
              {kokoroOn
                ? "warming — presets play on the fallback voice until it loads"
                : "built-in voice forced — the voice pick has no effect"}
            </span>
          )}
          {muted && (
            <button
              onClick={() => {
                setMuted(false);
                setMutedState(false);
                ensureAudio();
              }}
              style={{ ...pill, cursor: "pointer", color: "#fbbf24", borderColor: "#fbbf24" }}
            >
              sound is muted — unmute to hear anything
            </button>
          )}
          {armed && <span style={pill}>audio armed</span>}
        </div>
        {status && (
          <p style={{ ...sub, color: "#c4b5fd", fontWeight: 700 }} role="status" aria-live="polite">
            {status}
          </p>
        )}

        {!kokoroOn && (
          <p style={{ ...note_, color: "#fbbf24" }}>
            Kokoro is switched off (localStorage <code>saturday:kokoro=0</code> or <code>NEXT_PUBLIC_VOICE=tier1</code>
            ). Warm up re-enables it locally.
          </p>
        )}

        {/* 1 — statement */}
        <Section
          title="1 · Statement"
          note="One line to hear every knob. Type your own, or load a preset — the type picks the speed row, so a preset is a one-click A/B of that delivery."
        >
          <div style={row}>
            {LINE_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setLineType(t);
                  setLine(PRESET_LINES[t]);
                }}
                style={lineType === t ? activeChip : chip}
                aria-pressed={lineType === t}
              >
                {t}
              </button>
            ))}
          </div>
          <textarea
            value={line}
            onChange={(e) => setLine(e.target.value.slice(0, 400))}
            rows={3}
            spellCheck={false}
            aria-label="Statement to audition"
            style={textarea}
          />
          <p style={note_}>
            Cadence markers the engine reads: <code>...</code> ellipsis gap ·{" "}
            <code> — </code> dash gap · <code>[beat]</code> hard pause (never spoken).
          </p>
          <div style={row}>
            <button onClick={play} style={primaryBtn}>
              ▶ Audition as {lineType}
            </button>
            <button onClick={() => setLine(DEFAULT_LINE)} style={chip}>
              Reset statement
            </button>
            {LINE_TYPES.filter((t) => t !== lineType).map((t) => (
              <button key={t} onClick={() => audition(draft, line, t)} style={chip}>
                as {t}
              </button>
            ))}
          </div>
        </Section>

        {/* 2 — voice */}
        <Section
          title="2 · Voice"
          note="Biggest lever: each id is a different character. The ~92MB model is shared, so switching costs one small tensor load — not a re-download."
        >
          <div style={voiceGrid}>
            {VOICE_CHOICES.map((v) => (
              <button
                key={v.id}
                onClick={() => patch({ voice: v.id })}
                style={draft.voice === v.id ? activeVoice : voiceBtn}
                aria-pressed={draft.voice === v.id}
              >
                <strong>{v.label.split(" — ")[0]}</strong>
                <small style={{ opacity: 0.7 }}>{v.label.split(" — ")[1] ?? v.id}</small>
              </button>
            ))}
          </div>
          <div style={row}>
            <button onClick={() => audition({ ...draft, voice: "bf_emma" }, line, lineType)} style={chip}>
              Hear Emma (shipped)
            </button>
          </div>
        </Section>

        {/* 3 — cadence */}
        <Section
          title="3 · Cadence — speed"
          note="Kokoro has no pitch control. Speed (and punctuation) is the whole delivery: contrast between rows is what reads as personality."
        >
          {LINE_TYPES.map((t) => (
            <Slider
              key={t}
              label={t}
              help={LINE_HELP[t]}
              value={draft.speeds[t]}
              min={0.5}
              max={2}
              step={0.01}
              suffix="×"
              onChange={(n) => patchSpeed(t, n)}
            />
          ))}
          <div style={row}>
            <button onClick={() => setDraft((d) => ({ ...d, speeds: { ...DEFAULT_PROFILE.speeds } }))} style={chip}>
              Reset speeds to shipped
            </button>
          </div>
        </Section>

        {/* 4 — pauses */}
        <Section
          title="4 · Cadence — pauses"
          note="The silences between clauses. Shared by the neural voice and the built-in fallback, so both stay in step."
        >
          {PAUSE_KNOBS.map((k) => (
            <Slider
              key={k.key}
              label={k.label}
              help={k.help}
              value={draft[k.key]}
              min={0}
              max={k.max}
              step={10}
              suffix="ms"
              onChange={(n) => setPause(k.key, n)}
            />
          ))}
          <div style={row}>
            <button
              onClick={() =>
                patch({
                  pauseClause: DEFAULT_PROFILE.pauseClause,
                  pauseDash: DEFAULT_PROFILE.pauseDash,
                  pauseDots: DEFAULT_PROFILE.pauseDots,
                  pauseBeat: DEFAULT_PROFILE.pauseBeat,
                })
              }
              style={chip}
            >
              Reset pauses to shipped
            </button>
          </div>
        </Section>

        {/* 5 — fallback */}
        <Section
          title="5 · Built-in fallback voice"
          note="Only used before the neural voice warms up or if it fails to load. Off by default — leave it off unless a TV is stuck on the fallback."
        >
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={draft.tier1 !== null}
              onChange={(e) => patch({ tier1: e.target.checked ? { rate: 1.05, pitch: 0.95 } : null })}
            />
            Shift the fallback voice too
          </label>
          {draft.tier1 && (
            <>
              <Slider
                label="fallback rate"
                value={draft.tier1.rate}
                min={0.5}
                max={1.6}
                step={0.01}
                suffix="×"
                onChange={(n) => patch({ tier1: { rate: n, pitch: draft.tier1?.pitch ?? 0.95 } })}
              />
              <Slider
                label="fallback pitch"
                value={draft.tier1.pitch}
                min={0.5}
                max={1.6}
                step={0.01}
                suffix="×"
                onChange={(n) => patch({ tier1: { rate: draft.tier1?.rate ?? 1.05, pitch: n } })}
              />
            </>
          )}
        </Section>

        {/* 6 — export / import */}
        <Section
          title="6 · Use it in the game"
          note="Save to game writes the profile to this browser — that's the TV the game runs on. Export the JSON to move the same tuning to another laptop."
        >
          <div style={row}>
            <button onClick={save} style={primaryBtn} disabled={!dirty} aria-label="Save profile to the game">
              {dirty ? "Save to game" : "Saved"}
            </button>
            <button onClick={() => audition(saved, line, lineType)} style={chip}>
              ▶ Hear saved
            </button>
            <button
              onClick={() => {
                setDraft(saved);
                lastVoice.current = saved.voice;
                setStatus("Draft reverted to the saved profile.");
              }}
              style={chip}
              disabled={!dirty}
            >
              Revert to saved
            </button>
            <button onClick={reset} style={chip}>
              Reset to Emma (shipped)
            </button>
          </div>
          <label htmlFor="profile-json" style={label}>
            Profile JSON
          </label>
          <textarea id="profile-json" readOnly value={json} rows={12} spellCheck={false} style={{ ...textarea, fontSize: 13 }} />
          <div style={row}>
            <button onClick={copyJson} style={chip}>
              Copy JSON
            </button>
            <button onClick={downloadJson} style={chip}>
              Download .json
            </button>
          </div>
          <label htmlFor="profile-import" style={label}>
            Paste a profile JSON (from another device)
          </label>
          <textarea
            id="profile-import"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={4}
            placeholder='{ "voice": "bm_george", "speeds": { … } }'
            spellCheck={false}
            style={{ ...textarea, fontSize: 13 }}
          />
          <div style={row}>
            <button onClick={importJson} style={chip} disabled={!importText.trim()}>
              Load into lab
            </button>
            {importErr && (
              <span role="alert" style={{ color: "#ff8a8a", fontWeight: 700 }}>
                {importErr}
              </span>
            )}
          </div>
        </Section>

        <p style={note_}>
          Where the knobs live: voice + speeds → <code>lib/voiceKokoro.ts</code>, pause gaps →{" "}
          <code>lib/voice.ts</code> (<code>chunkLine</code>), words → <code>lib/hostPersonality.ts</code>. Profile
          contract + sanitizing → <code>lib/voiceProfile.ts</code>. Needs a human ear pass on the living-room TV.
        </p>
      </div>
    </main>
  );
}

// --- styles ------------------------------------------------------------------
const page: React.CSSProperties = {
  minHeight: "100dvh",
  background:
    "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(167,139,250,0.18), transparent 70%), linear-gradient(160deg, #020617, #0b0a2a 55%, #1e1b4b)",
  color: "#fff",
  padding: "32px 20px 80px",
};
const inner: React.CSSProperties = { maxWidth: 900, margin: "0 auto" };
const kicker: React.CSSProperties = {
  color: "#a78bfa",
  fontWeight: 700,
  letterSpacing: 2,
  textTransform: "uppercase",
  fontSize: 12,
  margin: 0,
};
const title: React.CSSProperties = { fontSize: "clamp(2rem,6vw,3.2rem)", margin: "8px 0", letterSpacing: "-0.02em" };
const sub: React.CSSProperties = { opacity: 0.75, lineHeight: 1.6, maxWidth: 720 };
const note_: React.CSSProperties = { opacity: 0.7, lineHeight: 1.6, fontSize: 14 };
const section: React.CSSProperties = {
  marginTop: 32,
  padding: 20,
  borderRadius: 16,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
};
const h2: React.CSSProperties = { margin: "0 0 6px", fontSize: 20 };
const row: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 12 };
const label: React.CSSProperties = { display: "block", fontWeight: 700, marginTop: 16, marginBottom: 6, fontSize: 15 };
const linkBtn: React.CSSProperties = {
  color: "#fff",
  textDecoration: "none",
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
};
const pill: React.CSSProperties = {
  fontSize: 12,
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.15)",
};
const chip: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.15)",
  cursor: "pointer",
  fontSize: 15,
};
const activeChip: React.CSSProperties = { ...chip, background: "#7c3aed", borderColor: "#7c3aed" };
const primaryBtn: React.CSSProperties = {
  padding: "12px 18px",
  fontSize: 15,
  fontWeight: 700,
  borderRadius: 10,
  background: "#7c3aed",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};
const textarea: React.CSSProperties = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  marginTop: 12,
  padding: 12,
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "rgba(0,0,0,0.4)",
  color: "#fff",
  fontSize: 16,
  lineHeight: 1.5,
  outline: "none",
  resize: "vertical",
  fontFamily: "inherit",
};
const voiceGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))",
  gap: 10,
  marginTop: 12,
};
const voiceBtn: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 10,
  background: "rgba(0,0,0,0.3)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.15)",
  cursor: "pointer",
};
const activeVoice: React.CSSProperties = { ...voiceBtn, borderColor: "#a78bfa", background: "rgba(124,58,237,0.35)" };
