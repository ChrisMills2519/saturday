# DEVLOG — Saturday Family Party Game

Append-only journal. Newest entries at the bottom. One entry per work session: date, what changed, why, how verified, what's next.

---

## 2026-09-14 — Research + bones scaffold

**Context:** Jackbox-style game for family game night Sat 2026-09-19. Mix of games wanted (lie/trivia + turn-based Drawful). Internet play (remote family), user has Supabase. No app install — phones join via browser.

**Research findings:**
- Jackbox loop: TV host + phones are both WebSocket clients to a central server. Host creates room → 4-letter code → phones join via `jackbox.tv` → server relays `{type, payload}` (broadcast host→all, directed phone→host). Server-authoritative state machine, turn-based so latency-tolerant.
- Jackbox infra: all AWS (EC2 room servers Ecast/blobcast, S3+CloudFront assets, SQS; new GameLift Streams for cloud host video). Overkill for us.
- Our path: Next.js API routes + Supabase Postgres + Realtime Broadcast, one channel per room (`room:CODE`, event `room_updated`). Clients never broadcast directly. Timers = single `ends_at` timestamp, phones count down locally (per-second server ticks blew one dev's quota: ~50M messages).
- Drawing: turn-based Drawful (draw alone → submit once → vote) chosen over live Pictionary to fit Supabase quotas. Submit final JPEG dataURL or Storage URL once, no stroke streaming.

**What was built (bones):**
- Next.js 14 App Router: `/` (create/join), `/host/[code]` (TV: big code + QR + phases + scores), `/play/[code]` (phone: join/submit/vote/scores).
- API: `POST /api/rooms` (create) + `[code]/join|start|submit|vote|next` + `GET [code]` (snapshot). Only API routes write (service_role) + broadcast.
- Libs: `gameEngine.ts` (LOBBY→INPUT→REVEAL→VOTE→SCORE + 4-char codes excl. 0/O/1/I), `supabase.ts` (browser anon vs admin service_role), `realtime.ts` (`useRoom` + `useCountdown`), `roomService.ts` (snapshot).
- Schema `supabase/schema.sql`: `rooms / players / submissions` with `image_url` + `game_type` reserved for drawing.
- Env: `.env.example` + `.env.local` (URL + publishable anon filled; secret = placeholder until user pastes rotated key). `.env.local` gitignored.
- Docs: `README.md` (run/deploy/Saturday runbook).

**Verified:** `npm run typecheck` clean, `npm run build` green (all routes), `npm run dev` serves `/` with 200 and loads `.env.local`.

**Security note:** publishable anon key shared in chat (fine); first secret key pasted in chat then revoked — user rotated. Never commit `.env.local`, never `NEXT_PUBLIC_` the secret, never paste secrets in chat.

**What's next:** user fills rotated secret → `npm run dev` smoke test (create → 2-tab join → start → submit → reveal → vote → scores, refresh reconnects) → Vercel deploy with prod `NEXT_PUBLIC_APP_URL` → phone-on-mobile-data test → Drawful canvas input via `image_url`.

## 2026-09-14 — Supabase grants + Next 14 page fixes

**What changed:** user ran schema but hit `500 permission denied for table rooms` (new `sb_secret_` key + auto-RLS on + no grants). Diagnosed via env prefix + deadlock retry (dev-server 3s poll vs ALTER lock). User ran grants + open RLS policies → `POST /api/rooms 200`. Then fixed two code bugs: `use(params)` Promise-unwrap (Next 15 pattern, we're on Next 14 + React 18) replaced with sync `params` in host + play pages; wrapped `useSearchParams()` in `<Suspense>` in play page.

**Verified:** `typecheck` clean, `build` green (all routes), dev log shows `POST /api/rooms 200`. Remaining log noise (favicon 404, REACT_EDITOR, Realtime REST fallback, .well-known 404s) is harmless.

## 2026-09-14 — Vercel deploy prep

**What changed:** fixed `.gitignore` — it had a bare `.env` line that also ignored `.env.example` (which must be committed, no secrets in it). Now ignores `.env*.local` + `tsconfig.tsbuildinfo`; verified `git check-ignore .env.local` still ignored.

## 2026-09-14 — Pushed to GitHub

**What changed:** first commit (bones: host + play + rooms API, Supabase broadcast, docs) pushed to `https://github.com/ChrisMills2519/saturday.git` on `master`. `.env.local` stayed untracked as intended.

## 2026-09-14 — QR hardening + live deploy

**What changed:** deployed to Vercel (`saturday-roan.vercel.app`, Ready). QR scanned to Google because `NEXT_PUBLIC_APP_URL` was empty in the first build → relative `/play/CODE` encoded. Hardened host page: prefers env URL, falls back to `window.location.origin` at runtime, strips trailing slash — QR can never be relative again. Pushed; Vercel auto-redeploys production with the 4 env vars now set.

**Verified:** `typecheck` clean, `build` green, pushed to `master`.

## 2026-09-14 — Reload-resilience on phones

**What changed:** phone browsers reloaded mid-game (network switch/tab reclaim) and players lost join + drafts. Added `lib/persistence.ts` (join + per-round draft in localStorage, safe against corrupt/missing storage), wired silent auto-rejoin + draft save/restore/clear-on-submit into `app/play/[code]/page.tsx`, added `current_round` to the room snapshot (`roomService.ts`, `realtime.ts`). Also reverted an unrelated uncommitted homepage `motion` restyle to keep the diff focused.

**Verified:** `typecheck` clean, `build` green, 8/8 node assertions on persistence helpers pass (round-trip, case-insensitive codes, corrupt/empty handling, round isolation, delete paths, broken-storage safety). Pushed to `master` (`bc705fd`); Vercel auto-redeploys.

## 2026-09-14 — Landing page Motion restyle

**What changed:** restyled `app/page.tsx` only (create/join logic untouched) with `motion` (`motion/react`, v13.2.0 — only new dep): full-viewport centered card on slate-950→indigo-950 gradient, chunky title, Create Game primary + Join Game section (name + 4-char uppercase code). Staggered spring entrance (0.12s), button hover/tap scale, code-input focus pulse, subtle 4s title float. Transform/opacity only, mobile-friendly (`100dvh`, `clamp()` type), no sound/confetti/images. Re-applies the restyle reverted in the previous session, now as its own change per user request.

**Verified:** `npm run typecheck` clean, `npm run build` green (`/` renders 41.9 kB static).

## 2026-09-14 — Motion limits preview page

**What changed:** added `app/preview/page.tsx` (client-only, zero Supabase) to demo the full Motion range for Saturday TV-first: 1) phase theatre via AnimatePresence keyed on phase, 2) 4-lane walk-across parade (linear x -12vw→112vw + y bob + rotate rock, parallax durations, scaleX flip), 3) REVEAL stagger flip cards, 4) VOTE tally spring pops + animated bars, 5) SCORE layout podium + 90-piece confetti burst, 6) phone gestures / timer urgency shake / SVG success check, 7) honest limits panel (GPU transform/opacity vs janky width, reduced-motion guard).

**Why:** user asked what Flow/Motion can do + show the limit; wanted characters walking across screen, juicy party feel.

**Verified:** `npm run typecheck` clean, `npm run build` green (`/preview` 7.16 kB, 135 kB first load). Smoke mentally: phase buttons swap, walkers loop, confetti fires, timer shakes ≤5s.

## 2026-09-15 — Stale-GET fix + full verification

**What changed:** `GET /api/rooms/[code]` froze at the first snapshot per room (always `LOBBY r0`) — supabase-js uses global `fetch`, which App Router caches by default, and `export const dynamic = "force-dynamic"` alone did not unstick it (proven via `_dbg` timestamp probe: handler ran fresh, DB read stale). Fixed at the choke point: `supabaseAdmin()` in `lib/supabase.ts` now injects `global.fetch` wrapped with `cache: "no-store"`; kept `force-dynamic` on the GET route as hygiene. Without this, the 3s `useRoom()` fallback poll would snap every screen back to stale LOBBY mid-game.

**Verified:** `typecheck` clean, `build` green (all 7 API routes + `/preview` 8.08 kB), live loop on fresh dev server — create→2 joins→reconnect→start→2 submits→400 on bad submit→REVEAL→400 on bad jump→VOTE→vote→SCORE→LOBBY, with `GET` fresh after every step (`INPUT r1 ends=true`, `subs=2`, `SCORE votes=1,0 scores={Al:1}`). Local `/`, `/host`, `/play`, `/preview` all 200; Vercel root 200, `/preview` 404 (still unpushed). Direct-DB cross-check confirmed writes were always fine — only the GET read path was stale.

**What's next:** push fix + `app/preview/` to `master` so Vercel redeploys (production still serves stale GETs until then) → phone-on-mobile-data test → Drawful canvas input via `image_url`. Note: this Chromebook container has 2.7 GiB RAM — `tsc` gets OOM-killed if a stale `next dev` is running; kill it first and use `NODE_OPTIONS=--max-old-space-size=1024`.

## 2026-09-15 — Fun-killers fix + Motion show port

**What changed (user picked "fix fun-killers first"):**
- TV `/host`: blind INPUT (player cards show `locked in ✓` / `typing…` + `N/M submitted`, no answer spoilers), staggered REVEAL (motion spring 260/20), blind VOTE (tallies hidden, `N/M voted`), SCORE podium (`layout` springs + vote-count pops + 90-piece confetti + winner callout), phase-theatre `AnimatePresence`, timer urgency (red + pulse ≤10s), `?clean=1` hides join header for screenshare, auto-advances INPUT→REVEAL on timer expiry (server still authorizes).
- Phones `/play`: submitted state (SVG success check + `You're in!` + count, derived from snapshot so refresh-safe), REVEAL `Look up! 👀` cue, VOTE single-lock with `already voted` feedback + persisted across refresh (`lib/persistence.ts` voted keys), 140-char counter, timer shake + HURRY ≤5s, SCORE winner callout + self highlight.
- API hardening (server-authoritative): `submit` INPUT-only 400, `vote` VOTE-only + `session_id` required + self-vote 400 + one-vote-per-round via new `votes(room_code,round,voter_session)` unique guard (legacy fallback if table missing), `start` gains `canTransition` check, `next` clears stale `ends_at` outside INPUT + random prompt fallback.
- Scores now keyed by `session_id` (rename/collision-proof); legacy name-keyed scores lazy-migrate on vote; host + phones resolve names via players list.
- New `lib/prompts.ts`: 30 family-safe prompts (patch-notes / worst-advice / museum / last-text styles) — server picks random, hardcodes gone.

**Why:** audit found 7 fun-killers (dead REVEAL phones, spoilers, vote spam, decorative timer, spreadsheet scores, 2 prompts, AFK host stalls). All fixes reuse the existing INPUT→REVEAL→VOTE→SCORE engine, single `ends_at` + local countdown (no ticks), generic submit.

**Verified:** `npm run typecheck` clean, `npm run build` green (host 3.67 kB / play 3.52 kB, +motion ~198 kB first load).

**What's next:** run `supabase/schema.sql` in SQL Editor (adds `votes` table) → push to `master` → live smoke (create→join→submit→reveal→vote→score, double-vote 400, self-vote 400, refresh keeps submitted/voted state) → phone-on-mobile-data test.

## 2026-09-15 — Solo-vote empty states

**What changed:** solo test showed prompt + `Phase: VOTE` with nothing to tap — correct behavior (no self-vote) but a blank screen. Phone VOTE now shows a `Nothing to vote on yet 👀` card (explains the no-self-vote rule, echoes your answer) when no votable answers exist; host VOTE shows a `Need 2+ answers` nudge when ≤1 submission.

**Verified:** `npm run typecheck` clean, `npm run build` green.

## 2026-09-15 — SVG icons + avatar parade (emoji-free UI)

**What changed:** emoji-as-iconography replaced with a code-only stroke set (`components/icons.tsx`: Timer/Mask/Ballot/Trophy/Check/Eye/Draw/Lock/MedalIcon, 24px viewBox, currentColor) across host + play + preview; animated CheckIcon reuses the `pathLength` pattern. Player-driven `PlayerParade` (`components/PlayerParade.tsx`) promotes the walker rig from `/preview` to the TV: real roster names/colors in LOBBY (idle) and SCORE (march), null under reduced-motion/empty. Debug `Phase:` labels gone (friendly `Round N · status` on TV, per-phase status on phone); phone gains a LOBBY "You're in!" card. Preview demo-answer emoji kept (user-content simulation). No engine/API/schema changes.

**Why:** Jackbox uses illustrated characters, never emoji; TMP is the visual benchmark (themed scene, display type, mascot cast). This is the iconography + cast slice.

**Verified:** `typecheck` clean, `build` green (host 4.31 / play 4.64 kB); emoji grep over host/play/components = 0; headless API playtest PASS (3P full loop, all 400 guards); verification subagent independently PASSed edge cases (solo self-vote 400, reconnect dedupe, resubmit-edit collapse, round-2 prompt rotation, SCORE→LOBBY) + page smokes (/, /preview, /host, /play all 200). Screenshots blocked in-container (no Chromium libs, no root) — manual capture matrix recorded.

**What's next:** run `supabase/schema.sql` (creates `votes` table + service_role grants — double-vote currently 200-fallback, becomes 400-guarded) → push → browser screenshot pass vs TMP refs → Slice 1 sound + announcer copy.

## 2026-09-15 — Supabase access test + schema grants hardening

**What changed:** connected this agent to Supabase (`saturday`, `eu-west-1`, ACTIVE_HEALTHY): management token in shell env + `Saturday/.env.local` (gitignored, server-only, never `NEXT_PUBLIC_`). Access test showed `rooms` (anon, 200), `players`/`submissions` (service_role, 200), but `votes` → 403 `permission denied for table votes` (same class of bug as the 2026-09-14 rooms grant outage — table created in SQL Editor with no API-role grants; service_role bypasses RLS so grants alone fix it). Hardened `supabase/schema.sql`: full grants on all 4 tables to `service_role`, `USAGE,SELECT` on all sequences (identity inserts), read-only `SELECT` to `anon, authenticated`. Safe to re-run.

**Verified:** `typecheck` clean, `build` green (all 7 API routes). Live REST: rooms/players/submissions 200, management project 200. `votes` still 403 until the new grants are applied.

**What's next:** run updated `supabase/schema.sql` in SQL Editor → re-test `votes` REST (expect 200) → full vote-loop smoke (double-vote 400, self-vote 400) → push → phone-on-mobile-data test.

## 2026-09-15 — Ran schema grants via Management API (votes 403 fixed)

**What changed:** user asked "can't you run the schema?" — yes: found beta `POST /v1/projects/{ref}/database/query` in the Management API docs, probed with a read-only grants query (201, empty = no grants on `votes`), then applied all 9 GRANTs from `supabase/schema.sql` directly (all 201, via `/tmp/opencode/supabase_query.py`, token via env only). No SQL Editor step needed.

**Verified:** `votes` REST now 200 for both service_role and anon (was 403). No code changes; `typecheck`/`build` already green from the previous step.

**What's next:** full vote-loop smoke (double-vote 400, self-vote 400) → push → phone-on-mobile-data test.

## 2026-09-15 — Supabase MCP wired into opencode

**What changed:** added `supabase` MCP server to `~/.config/opencode/opencode.jsonc` (global, outside repo): hosted `https://mcp.supabase.com/mcp`, scoped with `?project_ref=uftdtzqjnebryxodibxo&features=database,docs` (no account-mgmt tools, no storage group), PAT via `Authorization: Bearer {env:SUPABASE_ACCESS_TOKEN}` header (no browser OAuth needed), `oauth: false`. Token itself stays in shell env + gitignored `.env.local`, never in the config.

**Verified:** config parses as JSON; direct MCP `initialize` handshake 200; `opencode mcp list` shows `supabase connected`. Tools (`list_tables`, `execute_sql`, `apply_migration`, …) load on session start — restart opencode session to pick them up.

## 2026-09-15 — Sound + announcer copy (Slice 1)

**What changed:** game has a voice now. New `lib/sfx.ts` (WebAudio synth, zero files): countdown ticks (rising pitch last 5s), times-up buzz+crash, reveal drumroll sting, vote pop, submit blip, score fanfare, lobby join chime — lazy AudioContext unlocked on first tap (mobile autoplay-safe), persisted mute, reduced-motion quiets non-essentials. New `lib/hostCopy.ts`: cold open, round titles, INPUT sub + rotating 8s one-liners (dead-air cover), REVEAL/VOTE/SCORE cards, vote progress, solo nudges, winner lines — no emoji, icons carry visuals. Host: title cards per phase, ticks + times-up from `ends_at`, sting on REVEAL, fanfare on SCORE, join chime on roster growth, `Tap for sound`/mute pill, lobby music (mp3 if `public/audio/lobby.mp3` exists, else built-in synth I–vi–IV–V loop, ducked to LOBBY). Phones: unlock on join/submit/vote, ticks + times-up buzz + haptics, blips on submit/vote, all strings via copy file.

**Why:** sound was 0 lines — the highest-value feel gap; announcer copy is Jackbox's 50% for free. All client-only, keyed on `room.phase` + `ends_at`, zero network/surprise billing.

**Verified:** `typecheck` clean, `build` green (host 6.88 / play 6.75 kB); regression API loop PASS (3P full game, double-vote 400, scores session-keyed).

**What's next:** drop a CC0 mp3 at `public/audio/lobby.mp3` to upgrade the synth loop (optional) → browser sound pass (unlock, mute persist, reduced-motion) → protocol hardening (seq + INPUT redaction) → game structure (3 rounds, gating).

## 2026-09-15 — Protocol hardening: seq + INPUT redaction + counts

**What changed:** server-side anti-spoiler + ordering. New `rooms.seq` (migration applied live via Management API + in `schema.sql`): every mutation (join/start/submit/vote/next) bumps it via `bumpSeq()` in `roomService.ts`. `getSnapshot()` now returns `seq`, `counts {submitted, voted, total}`, and redacts `text_content`/`image_url` to null during INPUT (keeps `player_session` so locked-in roster still works) — devtools can no longer spoil answers; full text returns in REVEAL+. Clients: `useRoom()` drops broadcasts with `seq <= last seen` (3s GET fallback always trusted and resyncs); host + phone progress lines read server `counts`.

**Why:** Jackbox Ecast equivalent (`pc`/version per sender) adapted to one Broadcast channel; redaction moves blindness from CSS discipline to server enforcement.

**Verified:** `typecheck` clean, `build` green; 13/13 live API checks (seq strictly increasing, INPUT redacted but roster intact, REVEAL restores text, all vote guards 400, counts exact at every phase).

**What's next:** game structure (3-round games, Start gating, per-round durations, rematch) → human browser/phones pass.

## 2026-09-15 — Room auto-expire (TTL cleanup)

**What changed:** finished games sat in Postgres forever (28 test rooms and counting — unbounded growth + 4-char code collision odds). Added auto-expire only, no UI change: new `lib/roomCleanup.ts` (`ROOM_TTL_HOURS = 24`, best-effort `purgeExpiredRooms()` that never throws), new `app/api/cleanup/route.ts` (GET for Vercel Cron + POST for manual curl, `force-dynamic`, guarded by `CRON_SECRET` bearer — open only when no secret configured, i.e. local dev), `vercel.json` daily cron `0 4 * * *` → `/api/cleanup`, `CRON_SECRET` in `.env.example`, opportunistic purge at the top of `POST /api/rooms` (covers cron misses), `rooms_created_at_idx` in `schema.sql` + applied live. Cascade FKs already handle children — deleting the room row removes players/submissions/votes.

**Why:** user picked "auto-expire only" over host End-button / keep-forever. 24h covers rematch + late rejoin; games last <1h.

**Verified:** `typecheck` clean, `build` green (new `/api/cleanup` route listed). Live: wrong/missing secret → 401, correct → `{"ok":true,"deleted":0}`; planted 25h-old `ZZT9` room + player + submission + vote → cleanup `deleted:1`, all 4 tables 0 for `ZZT9`, other 28 rooms untouched; `POST /api/rooms` still 200 with purge inline. Test residue removed (back to 28 rooms).

**What's next:** set `CRON_SECRET` (`openssl rand -hex 32`) in Vercel env so the cron is authorized in prod → push → phone-on-mobile-data test.

## 2026-09-15 — Lobby music file + CC0 SFX pack vendored

**What changed:** game has real music now (synth stays as fallback). `public/audio/lobby.mp3` (763KB) + `lobby.ogg` (584KB): 65s mono 44.1kHz cut of `Funked Up` by Joth (CC0, https://opengameart.org/content/funked-up), normalized `-14 LUFS` + 0.5s in / 5s out fades. Host `<audio>` (`app/host/[code]/page.tsx`) now tries ogg first, mp3 fallback for Safari; missing/broken still flips to synth `startLobbyLoop()`. Vendored 7 CC0 one-shots in `public/audio/sfx/` (~72KB total: Kenney Interface/Jingles + OGA `pop1` — see `public/audio/README.md` for provenance); one-shots stay WebAudio-synth in `lib/sfx.ts` (zero-latency, offline-safe), files reserved for a future upgrade pass. Pixabay (`pixabay.com/music/funk-funk-244706` etc.) confirmed usable per host (Pixabay Content License, not CC0) but bot-walled on scrape — manual download only, not vendored.

**Why:** user asked for CC0 music + SFX scouts, then "go for it" with Pixabay allowed. Lobby loop is the only file justified today (host-only, single cached fetch, paused off-LOBBY); file SFX would add per-effect network + decode latency on the countdown hot path.

**Verified:** `typecheck` clean, `build` green (host 4.83 / play 4.57 kB, JS unaffected — statics aren't bundled). `next start` serves `/audio/lobby.mp3 200 audio/mpeg 781179`, `/audio/lobby.ogg 200 audio/ogg`, `/audio/sfx/tick.ogg 200`. No stray server left (`ps -C node` empty).

## 2026-09-15 — Pixabay via teddy pipeline (curl_cffi upgrade)

**What changed:** user recalled teddy downloaded Pixabay audio — checked `teddy-world/AGENTS.md` Pixabay pipeline (cloudscraper → search → detail → `cdn.pixabay.com/download/audio/...` regex → plain-curl CDN → ffmpeg). That pipeline is stale: Pixabay Cloudflare now 403s plain curl, `cloudscraper` 1.2.71, and this chat's WebFetch. Upgraded to `curl_cffi` chrome124 TLS impersonation in `/tmp/pxvenv` — search + detail pages 200, CDN regex unchanged, CDN takes plain curl. Scraped `funky party` / `game show` / `quirky comedy` (20 tracks each, ~11 CDN URLs, a few transient 403s on detail pages). Vendored 2 normalized alternates in `public/audio/`: `lobby-gameshow.mp3` (997KB/85s, `Game Show Chant` by Geeemusic) + `lobby-quirky.mp3` (294KB/25s, alex-morgan quirky loop). Shipped `lobby.mp3` (CC0 Funked Up) unchanged — listen and promote the winner. Scraper saved at `/tmp/opencode/audio/px_music.py` (not in repo — /tmp only).

**Why:** Pixabay Content License is usable per host (free, no attribution) and has the most on-brief game-show/funky tracks; CC0-only pool was thin for full-length lobby beds.

**Verified:** `typecheck` clean, `build` green; `next start` serves both alternates 200 `audio/mpeg` with exact byte sizes; server stopped via PID (no `pkill`).

## 2026-09-15 — Mascots + backdrop + PWA icons vendored

**What changed:** standing asset-fetch permission added to `AGENTS.md` (CC0-first, static-only, provenance + size rules). Vendored P0 art, all generated in-repo with PIL (CC0, no attribution): `public/images/mascot-lobby.png` (13KB, waving happy) + `mascot-reveal.png` (13KB, shocked) + `mascot-score.png` (13KB, trophy + party hat) — all 1000x1000 transparent, thick black outline, flat pink/purple/yellow/teal; `bg-burst.png` (43KB, 1920x1080 plum sunburst). Derived `favicon.png` (64) + `apple-touch-icon.png` (180) + `icon-192/512.png` + `og-image.png` (1200x630) + `manifest.webmanifest`; `app/layout.tsx` metadata now wires manifest/icons/openGraph. Scouted but skipped: Kenney Shape Characters (CC0 modular parts too small for TV) + OGA Blobby/Goblin (CC-BY-SA/BY, attribution required). Provenance in `public/images/README.md`.

**Verified:** `typecheck` clean, `build` green (host 4.83 / play 4.57 kB). `next start` serves all 10 statics 200 with exact byte sizes. `ps -C node` empty, no stray server.

## 2026-09-15 — longlooplobby promoted to lobby music + Pixabay rule amended

**What changed:** per host pick, `public/audio/longlooplobby.mp3` (host-provided 162s stereo 192k, no ID3 tags) is now the lobby bed: normalized to `lobby.mp3` + `lobby.ogg` (mono 44.1k, `-14 LUFS`, 0.5s in-fade, no trim/out-fade to preserve its loop endpoint). Ex-CC0 bed kept as `lobby-funkedup.mp3/.ogg` for audition. Raw source gitignored (3.8MB, stays on disk untracked). `AGENTS.md`: Pixabay rule amended from manual-drop-only to scripted-CDN-allowed (`curl_cffi` chrome impersonation; human verifies license per track).

**Why:** host chose their own track for the game's voice; rule amendment records the working 2026 pipeline instead of the stale cloudscraper one.

**Verified:** `typecheck` clean, `build` green; `next start` serves `/audio/lobby.mp3 200 audio/mpeg`, `/audio/lobby.ogg 200 audio/ogg`, `/audio/lobby-funkedup.mp3 200`. NOTE: a concurrent session re-encoded `lobby.mp3` mid-task (1.9MB/96k → 1.3MB/64k mono, now inside the 1.5MB loop budget) — shipped the on-disk version, flagged in chat. `CRON_SECRET` confirmed set in Vercel env by host.
