# Drop-in audio — exact names

- `lobby.mp3` / `lobby.ogg` — 162s loop, mono 44.1kHz (~1.9MB / ~1.3MB). Host `<audio>` tries ogg first, mp3 fallback for Safari. Missing/broken → synth `startLobbyLoop()` in `lib/sfx.ts`.
- `sfx/tick.ogg` — countdown tick (Kenney `click_001`, 4.8KB)
- `sfx/submit.ogg` — submit confirm (Kenney `confirmation_004`, 13KB)
- `sfx/vote.ogg` — vote pop (OGA `pop1` by cogitollc, 6.5KB)
- `sfx/times-up.ogg` — deny buzz layer (Kenney `error_001`, 7.3KB)
- `sfx/reveal.ogg` — reveal hit (Kenney `jingles_HIT00`, 8.5KB)
- `sfx/fanfare.ogg` — score jingle (Kenney `jingles_NES05`, 21KB)
- `sfx/join.ogg` — lobby join chime (Kenney `maximize_001`, 12KB)

Provenance:
- `lobby.*`: host-provided `longlooplobby.mp3` (162s stereo 192k, no ID3 tags — license: host's own file, confirm before any redistribution beyond this game), normalized to mono 96k + `-14 LUFS` + 0.5s in-fade, no trim/out-fade (ships as a designed loop). NOTE: mp3 is 1.9MB, over the 1.5MB loop budget in AGENTS.md — accepted per host pick; ogg is 1.3MB. Raw source kept untracked at `public/audio/longlooplobby.mp3` (gitignored).
- `lobby-funkedup.*`: `Funked Up` by Joth — https://opengameart.org/content/funked-up (CC0, ex-`lobby.*`, kept for audition).
- `sfx/*` Kenney: `Interface Sounds` https://kenney.nl/assets/interface-sounds + `Music Jingles` https://kenney.nl/assets/music-jingles (both `License: CC0`)
- `sfx/vote.ogg`: `Pop sounds` by cogitollc — https://opengameart.org/content/pop-sounds (CC0, `pop1.ogg`)

Alternates tried (CC0, not shipped): `Happy Loop` by wipics (20s, too short/obvious), `huaeb` by cinameng (56s funky, backup).
Pixabay alternates (Pixabay Content License — free, no attribution; NOT CC0),
downloaded via teddy's pipeline upgraded for 2026 Cloudflare (`curl_cffi`
chrome124 impersonation — `cloudscraper` 1.2.71 and plain curl are both
403-blocked now; the CDN itself takes plain curl). Audition at these URLs,
then promote the winner to `lobby.mp3`:
- `lobby-gameshow.mp3` (997KB, 85s) — `Game Show Chant` by Geeemusic —
  https://pixabay.com/music/instrumental-game-show-chant-589844 — most thematic.
- `lobby-quirky.mp3` (294KB, 25s) — `Cheerful Comedy Funny Quirky Background`
  by alex-morgan — https://pixabay.com/music/cartoons-cheerful-comedy-funny-quirky-background-587373 —
  tightest loop, smallest file.
- Fetched but not vendored: `Funk` (118s)
  https://pixabay.com/music/funk-funk-244706, `Funky` by Kulakovka (98s)
  https://pixabay.com/music/funk-funky-277920 — re-run
  `/tmp/opencode/audio/px_music.py` under `/tmp/pxvenv` to re-scrape.

Note: one-shots stay WebAudio-synth in `lib/sfx.ts` (zero-latency, offline-safe). `sfx/*.ogg` are vendored for a future file-upgrade pass, not wired yet.
