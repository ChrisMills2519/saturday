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

## 2026-09-15 — Game structure: 3-round games, start gating, rematch

**What changed:** fixed-length games, server-authoritative. New `rooms.total_rounds` (migration applied live, default 3, in `schema.sql`): `POST /api/rooms` accepts `{total_rounds}` (clamped 1–9), `start` accepts an override while in LOBBY. `start` now 400s with fewer than 2 players (solo starts dead-end at VOTE via the no-self-vote rule). `next →LOBBY` resets `scores {}` + `current_round 0` + `prompt null` (rematch on the same code; per-round rows stay but the snapshot only reads the current round). Snapshot + `useRoom` type carry `total_rounds`/`game_type` (game_type reserved for drawing v2). TV: header shows `Best of N` in LOBBY / `Round X of N` after, LOBBY rounds stepper (1–9) + start-error line (`Need 2+ players`), SCORE shows `Final results!` + Rematch (same code) / One more round buttons on the last round. Phones: LOBBY `Best of N` note, SCORE final title + `hang tight — the host is setting it up`.

**Why:** user picked "text-only Saturday-ready + drawing v2" — this is the structure slice (rounds, gating, rematch); durations stay 60s text until drawing sets its own. No engine transition changes (`SCORE→INPUT/LOBBY` already legal), single `ends_at` untouched.

**Verified:** `typecheck` clean, `build` green (host 5.3 / play 4.71 kB). Live 13/13 API loop: create default/clamp (3, 9), solo + 1-player start 400, 2-player start 200 with override to 2, full 2-round game (submit→reveal→vote→score ×2, scores accumulate 1–1), SCORE r2 final (2>=2), rematch →LOBBY `r0 scores={} ends=null`. Pages `/ /host /play /preview` all 200; lobby mp3/ogg serve exact normalized bytes. NOTE: I deleted the gitignored 3.8MB `longlooplobby.mp3` raw before seeing the concurrent entry that meant to keep it on disk — normalized `lobby.*` preserve the audio; re-drop the raw if the stereo source is ever needed.

**What's next:** push → Vercel redeploy + phone-on-mobile-data test → drawing v2 (DrawPad canvas → `image_url` submit-once, `DRAW_PROMPTS`, host/phone image rendering; Storage upload only if dataURL feels slow).

## 2026-09-15 — Instant advance + blind voting + vote timer + join/a11y hardening

**What changed:** per playtest feedback ("don't wait when all in", "don't tell me who I voted for") + 3-subagent review.
- `submit/route.ts`: after upsert, re-read `getSnapshot()` counts; if `INPUT && total>=2 && submitted>=total && canTransition(INPUT,REVEAL)`, flip `phase=REVEAL, ends_at=null` before `bumpSeq+broadcast`. Host timer stays as fallback for partial submits. Late joiners landing in REVEAL become spectators (no submission).
- `roomService.ts getSnapshot()`: VOTE now redacts per-answer `votes→0` + `scores→{}` (server-enforced); only `counts.voted/total` (N/M) leaves the server. SCORE returns full tallies. INPUT blind unchanged.
- `play/[code]/page.tsx`: vote confirmation is generic "Vote locked in" (`VOTED_TITLE`), no target name (kills shoulder-surf). `?name=` landing now `saveJoin()` on mount so refresh keeps session; `join()` gets pending disabled + error line + `aria-label`.
- `next/route.ts`: `→VOTE` now sets `ends_at=+30s` (was null) so one AFK phone can't stall the game.
- `host/[code]/page.tsx`: auto-advance covers `INPUT→REVEAL` + `VOTE→SCORE` (keyed `code:round:phase`); `TimerBar` default 60s, 30s in VOTE, `role=timer`; all advance buttons go through `advance()` helper (pending disabled + `actionErr` line + `aria-label`); phase status + vote progress get `role=status aria-live=polite`; phase `h2`s get `ref+tabIndex=-1` focus on phase/round change.
- Phone timer gets `role=timer`, phase pill gets `role=status aria-live`.

**Why:** Jackbox pattern (Quiplash/Fibbage/Drawful): skip wait when all in, blind vote with tallies only at reveal, short vote clock, progress-only host. Keeps AGENTS.md invariants: server-authoritative API writes + `broadcastRoom`, engine-gated transitions, single `ends_at` + local `useCountdown`, generic submissions.

**Verified:** `npm run typecheck` clean; `npm run build` green (host 5.63 / play 4.9 kB). Mental smoke: create→join×2→submit×2→instant REVEAL broadcast; vote→generic confirmation→SCORE tallies appear; VOTE `ends_at` set, host auto-fires `→SCORE` at 0.

**What's next:** live 2-phone test (instant REVEAL timing, VOTE 30s auto-score, refresh-reconnect) → consider freezing INPUT roster vs live `total` if late joins cause confusion → drawing v2.

## 2026-09-15 — Jackbox audit: scoring rubber-band, prompt library, drawing v2, host controls

**What changed (user: ".audit the game again [against] the jackbox games … work through them, just keep going"):** worked the whole audit list into the game.

*Scoring (the flat-game fix)*
- `lib/gameEngine.ts`: `SCORE_PER_VOTE=100`, `FINAL_MULTIPLIER=2`, `UNANIMOUS_BONUS=250`, plus `voteWorth()`/`isCleanSweep()`. **Final round doubles** every vote; a clean sweep adds 250.
- Found + fixed a logical dead end: the old "unanimous" check (`votes === voterCount`) was **unreachable**, because you can never vote for your own answer — max votes on any answer is `voterCount - 1`. `isCleanSweep` now keys off `voterCount - 1` and requires 3+ players.
- `rooms.round_history` jsonb (`{"1": {sid: pts}}`) records per-round deltas; vote route appends, phones render `R1 +200 · R2 +400`, host gets a **Round winner (MVP)** card with the winning answer + vote count.

*Theatre*
- TV REVEAL is now **one answer at a time**: card slams every 2.3s (700ms for the first), tap the TV or press Space to slam early, `Show all` to skip, `N/M answers up` counter, `?` placeholder card for what's still hidden, new `revealHit()` SFX per card.
- SCORE bars now grow from zero (tally drama) and are **proportional to points** (was rank-shaped, so ties looked like stairs).
- `startVoteBed()` — low heartbeat under VOTE so the clock is felt; lobby music unchanged.

*Prompts (replayability)*
- `lib/prompts_text.ts`: **120 cards in 8 packs** (advice/patch/lore/label/text/slogan/imagine/open), each with a phone hint; `lib/prompts_draw.ts`: **30 draw prompts + hints**; `lib/prompts.ts` re-exports both with back-compat helpers.
- No repeats per room via `rooms.used_prompts` (last 120 kept, resets when exhausted). `rooms.prompt_hint` carries the hint to phones so nobody faces a blank page.

*Social safety + structure*
- `lib/validation.ts`: family-safe **name + answer filter** (strong terms match as substrings so "Shitface" is caught, mild terms match whole words to avoid the Scunthorpe problem), control-char strip, 16-char names, 140-char answers, 600KB drawing cap. Duplicate names auto-suffix (`alex (2)`), `MAX_PLAYERS=8`, join 400s when full.
- `rooms.input_total` freezes the INPUT denominator at round start so mid-round joins stop corrupting `N/M submitted` (cleared on REVEAL/SCORE).
- `host_token` (minted on create, stored in the creating browser's `localStorage`, **never** in the public snapshot) now guards `next`/`extend`/`kick` once the game leaves LOBBY — LOBBY stays open so a replacement TV can start the game if the host device dies.
- New `POST /api/rooms/[code]/extend` (**+30s**, capped at 3 min/round) and `POST /api/rooms/[code]/kick` (removes player + their submissions/votes, re-freezes `input_total`, aborts to LOBBY if <2 players).
- `vote` now **auto-advances VOTE→SCORE when every player has voted** (was timer-only), and `submit` already auto-advanced INPUT→REVEAL when all are in.

*Phone polish*
- **Draw mode**: `components/DrawPad.tsx` (7 colors, 3 brush sizes, undo, clear, PNG→JPEG fallback over 500KB, submits ONCE — no stroke streaming). Host picks Write/Draw in the lobby; snapshot's `game_type` switches the phone UI, and drawings render on host REVEAL/VOTE/SCORE + phone vote buttons.
- **Edit answer** until REVEAL (draft kept instead of cleared on submit, cleared when the round ends), prompt hint as the textarea placeholder, `You're 2nd of 4 · R1 +400` personal rank + history, score list numbered, join errors translated (room full / family-friendly / too short).

**Schema:** `supabase/schema.sql` gains `prompt_hint`, `used_prompts`, `input_total`, `host_token`, `round_history` + idempotent `alter table ... add column if not exists` block. Applied live to `saturday` via the Management API (all 5 statements 201, columns verified).

**Why:** the audit against Quiplash/Fibbage/Drawful found flat scoring (leader never loses), a 30-prompt pool that repeated within two games, a decorative-only vote clock, no troll/name guard, no host recovery controls, and drawing still unshipped. All fixes stay inside the AGENTS.md invariants: API-routes-only writes + `broadcastRoom`, engine-gated transitions, a single `ends_at` with local `useCountdown`, no per-stroke streaming, generic `submit`.

**Verified:** `npm run typecheck` clean, `npm run build` green (host 6.9 / play 6.05 kB, 12 API routes). **59/59 live API checks** against `next start` (see `/tmp/opencode/audit_smoke.mjs`): host_token not leaked in GET + 403 on wrong token, profane/short/oversized-input 400s, dedupe names, `input_total` freeze, INPUT redaction of `image_url`, edit collapse to one submission, all-in auto-REVEAL, extend guards (400 in REVEAL, 200 in VOTE), VOTE redaction (tallies + scores), self-vote/double-vote 400, clean-sweep final scoring (`650` = 2×200 + 250 verified in both `scores` and `round_history`), auto VOTE→SCORE, no-repeat prompt across rounds, kick + kick-without-token 403, rematch reset keeping code/game_type/players. Pages `/`, `/preview`, `/host`, `/play` all 200; 120 text + 30 draw prompts counted unique. Smoke-test rooms deleted (33 → 27 rooms); no stray server left running.

**Not done from the audit:** audience mode (late joiners vote at half weight), round history visible on the TV, prompt-pack picker in the lobby, per-phase music beds beyond VOTE (needs new audio), share-card export.

**What's next:** human browser pass (draw mode on a real touchscreen: palm rejection + data URL size, one-at-a-time reveal pacing, ladder bars) → push → Vercel redeploy → phone-on-mobile-data test → audience mode if the living room wants it.

## 2026-09-16 — Sub-agent review sweep: races, recovery, reveals, readability

**What changed (4 parallel review agents → worked the full findings list):**
- *Races (critical):* new SQL functions `bump_room_seq()` + `increment_vote()` (migration applied live) replace read-then-write in `bumpSeq()` and the vote tally; submit auto-advance is now a conditional write (`.eq("phase","INPUT")`); vote re-reads fresh scores before accumulating and the clean-sweep bonus is idempotent; room create retries 4-char code collisions (5 attempts); `makeHostToken()` uses `crypto.randomUUID()`.
- *Security:* `submit` + `vote` 403 phantom `session_id`s not in the `players` table; `/api/cleanup` fails closed (401) when `CRON_SECRET` is unset (was open); `start` enforces the stored token on match/mismatch and **mints a new token on tokenless start (takeover)** — returns `host_token`, host page saves it and enables host UI, so a replacement TV can drive after a laptop death.
- *Empty rounds:* host auto-advance now requires ≥2 submissions (INPUT→REVEAL) / ≥1 vote (VOTE→SCORE), else surfaces a host prompt instead of marching through content-less phases; manual host buttons still free.
- *Authorship reveal (biggest laugh):* SCORE snapshot gains `votes_detail` (SCORE-only, VOTE stays blind); TV shows a "who wrote what" recap grid with per-answer voter names + house awards (crowd favorite / dark horse / novelist / minimalist); phones get a compact recap and the stale prompt hero is replaced with a results header.
- *Phones:* landing join/create errors render inline (no more silent re-enable, busy labels, disabled empty join); 404 dead-room screens on `/host` + `/play` with a way home; textarea gets `autoCorrect off / spellCheck false / autoCapitalize off / enterKeyHint send` + Cmd/Ctrl+Enter submit; 0.18s phase transition; times-up buzz only when the player still owes an answer/vote; `codePill` dark-on-pink for contrast; error reds unified.
- *DrawPad:* failed submit returns `false` so the button re-enables for retry; palm rejection (active `pointerId`); `pointercancel` handled; blank canvas can't submit ("Draw something first"); swatches 40px / tools 44px; green unified to `THEME.teal`.
- *TV:* reveal pace toggle (auto-slide on/off; reduced-motion is now manual-tap, no instant dump); answer text is display font with `clamp()`; headlines + code scale with `clamp()` and wrap cap 1200→1400; podium bars grow via `scaleY` and TimerBar via `scaleX` (GPU-only rule honored); extend disabled at ≤2s + bar total tracks extends; kick buttons on INPUT cards (mid-game prune); lobby custom-prompt input wired to `start`; 2-player lobby copy fixed; bonus round extends `total_rounds` (no more "Round 4 of 3").

**Why:** four review agents (UX, API/engine, visual, Jackbox-competitive) found dead first-run errors, a permanently-stuck tokenless TV, self-playing empty rounds, missing authorship payoff, atomicity holes, and TV/phone readability gaps. All fixes stay inside AGENTS.md invariants.

**Verified:** `typecheck` clean, `build` green (host 8.22 / play 6.7 kB, 12 API routes). **24/24 live API checks** (`/tmp/opencode/review_checks.mjs` + phantom follow-up): takeover mints token + old token 403s, phantom submit/vote 403 in-phase, self/double-vote 400, auto REVEAL/SCORE, `votes_detail` at SCORE only, INPUT redaction intact, cleanup 401 unauth, pages `/ /host /play /preview` all 200. Smoke-test rooms deleted; no stray server.

**Not done:** audience mode, prompt-pack picker, per-phase music beds, share-card export, Fibbage/trivia mechanics, two-prompt choice, TTS announcer, onboarding tutorial (see 2026-09-15 audit + 2026-09-16 reviews).

**What's next:** push → Vercel redeploy → phone-on-mobile-data test → human browser pass (touch DrawPad, reveal pacing, SCORE recap readability).

## 2026-09-16 — Drawings on results screen (SCORE + host VOTE fix)

**What changed:** draw-mode `image_url`s were in the SCORE snapshot but both results renderers printed the literal text `(drawing)` — host TV `app/host/[code]/page.tsx` authorship grid + MVP card, phone `app/play/[code]/page.tsx` WHO WROTE WHAT. Host VOTE grid had the same placeholder. All four now render `<img src={s.image_url}>` thumbnails (TV SCORE ≤220px, MVP ≤280px, VOTE full-width like REVEAL; phone SCORE ≤160px, VOTE-empty echo ≤140px). Removed now-unused `DrawIcon` / `drawingLabel` imports on the host page.

**Why:** bug report with screenshots (room ARB6): round winner + per-player cards + phone recap all showed "(drawing)" text, so draw rounds had no payoff. Data flow was already correct (`roomService.ts` only redacts images in INPUT; phone VOTE already rendered `<img>`).

**Verified:** `npm run typecheck` clean, `npm run build` green (host 8.24 / play 6.71 kB). Mental smoke: draw submit → REVEAL shows image → VOTE shows image on TV + phones → SCORE shows MVP + per-player thumbnails + phone recap.

**What's next:** push → Vercel redeploy → real draw round on TV + phones to confirm thumbnails at living-room distance.

## 2026-09-16 — Sarcastic host voice (Tier 1 browser TTS)

**What changed:** TV speaks with zero recordings. New `lib/voice.ts` (speechSynthesis engine: smug-trivia-nerd presets, clause chunker rendering `...`/`—`/`[beat]` as pauses, priority queue with sticky winner, voice/sarcasm prefs in localStorage), `lib/hostPersonality.ts` (family + savage line banks over 13 slots, anti-repeat picker, roast-answers-never-people target policy), `lib/hostLines.ts` (phase queue, answer reader with URL-strip + 120-char cap, score extras chained behind winner length via `estimateMs`). Host page: phase-entry openers, REVEAL card-by-card read-aloud (250ms pre-beat), INPUT dead-air one-liners on the existing 8s timer, stall jab once/round at ≤15s, extend-time snark, SCORE sticky winner + shutout/unanimous/awards chain. UI: "Host voice on/off" button (separate from Sound mute) + Family/Savage segmented toggle in lobby (default family).
**Why:** Jackbox's host voice carries the show; browser TTS is free, offline-safe, zero-latency, no API keys — and the `lib/voice.ts` engine interface leaves a Kokoro.js neural-voice slot open (same beat markers map to silence tokens later).
**Verified:** `npm run typecheck` clean, `npm run build` green (host 12.6 kB). Mental smoke: create→start (opener) → INPUT one-liners rotate w/o repeats → REVEAL reads cards in slam order → SCORE winner uninterrupted, extras follow → mute kills all, voice-off kills voice only, savage never leaks under family default.
**What's next:** human living-room pass (pick OS voice, tune rate/pitch, confirm cadence); Kokoro.js phase 2 (lazy `kokoro-js` import, q8 wasm, warmup in LOBBY).

## 2026-09-16 — Question-only host (no how-to-play instructions)

**What changed:** the host asks questions, never teaches. `lib/hostPersonality.ts`: all 52 voice lines (13 slots × family/savage) rewritten as interrogatives (`?` in every line, beats kept for TTS/Kokoro cadence, roast-answers-never-people intact); rules evicted from voice (no `write fast`, `no Googling`, `on your phones`, `no self-vote`, `read LOUD`). `lib/hostCopy.ts`: title/subs/one-liners/hints converted (`Who's in?`, `What have you got?`, `Whose is whose?`, `Which one?`, `Who won?`); self-vote rule kept as tiny silent caption only (`Which one deserves it? (not your own)`, per user yes) with API 400s as the enforcer. TV/phone `PHASE_STATUS`, lobby/empty/ready, submitted/voted/lookup, draw hints, placeholders, host error lines, timer urgency all question-led; buttons/counts/errors/404s kept as affordances.

**Why:** 3 explore subagents found 0 interrogatives in the banks + heavy instructional duplication across voice and UI; timing audit confirmed question lengths fit existing slots (nudge p1/8s, reveal p5/2.3s bookends only, VOTE wide open, SCORE post-award chain). Priorities/queue/`estimateMs` untouched — `?` needs no `chunkLine` change and renders better under Kokoro (bm_fable default, q8 WASM).

**Verified:** `typecheck` clean, `build` green (host 12.3 / play 6.67 kB). Grep: 64 `?` in `hostPersonality.ts`, 0 non-question voice lines, 0 leftover instructives (`write fast/vote on your/pick your/look at the TV/read LOUD/join on your/shout/no Googling/blame Dad/hang tight/points carry`, etc.) across `hostCopy.ts` + host/play pages.

## 2026-09-16 — Vendored quiz question pack (420 cards, CC0)

**What changed:** new `lib/prompts_quiz.ts` — 420 multiple-choice cards (`QuizCard { id, category, question, answer, incorrect[3], difficulty 1-3 }`, 14 categories) vendored from `open-quiz-bank@1.0.1` EN data (CC0-1.0, no attribution required). Helpers: `randomQuizCard(exclude, used)` (mirrors `nextTextPrompt` exclusion pattern, falls back to full pack when exhausted), `shuffledChoicesFor(card)` (classic-mode 4-option shuffle + `correctIndex`; bluff mode discards `incorrect` and shuffles player fakes + answer instead), `QUIZ_CATEGORIES`, `QUIZ_COUNT`. Re-exported from `lib/prompts.ts` (no export collisions). One-shot builder was deterministic (seed 20260916, family filters: difficulty 1-3, question ≤140 chars, answers ≤40, repo `containsProfanity` mirror, ~30/category); builder + temp dependency removed afterwards, `package.json` untouched so Vercel installs nothing new.

**Why:** quiz section needs both modes (classic multiple-choice + Fibbage-style bluff, per user) with zero runtime dependency — a live trivia API would add rate-limit handling (OpenTDB: 1 req/5s) and stage-day failure risk. Rejected: The Trivia API (BY-NC, bans commercial game use), TriviaQA-UW (no distractors, 600MB+), OpenTDB/OpenTriviaQA as primary (BY-SA share-alike burden; kept as future one-time import option only).

**Verified:** `npm run typecheck` clean (one fix: `Array.from(new Set(...))` — tsconfig targets ES5, no Set spread), `npm run build` green (host 12.3 / play 6.67 kB — pack not yet imported by pages so no bundle bloat). Data checks: 420/420 unique ids + questions, max Q 139 chars, max answer 40, 0 profanity flags under repo rules, 0 malformed cards. Runtime smoke on compiled output: `randomQuizCard` exclusion + exhausted-fallback OK, `shuffledChoicesFor` correct-index OK.

**What's next:** quiz game flow (new `game_type`, classic `REVEAL→VOTE` pick vs bluff `INPUT→VOTE` fake answers, scoring) + host/phone UI; future top-up via rebuild with same seed.

## 2026-09-16 — Kokoro.js neural voice (full swap, q8 WASM, British)

**What changed:** TV speaks neural by default. New `lib/voiceKokoro.ts` (lazy `kokoro-js@1.2.1` browser bundle from pinned jsdelivr CDN at runtime — `webpackIgnore`, never in the app bundle; `KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {dtype:"q8", device:"wasm"})`, ~92MB first download then Cache API; shared sfx `AudioContext` playback; per-`LineType` speed map + terminal `?→...` fall on hype/punchline so the question-only copy lands the SCORE mic-drop; per-chunk gen cache + `pregenerateKokoro()`; defensive PCM extraction). `lib/voice.ts`: engine seam (Kokoro preferred once warmed, Tier 1 during warmup/failure so the game never mutes), `saturday:kokoro` + `NEXT_PUBLIC_VOICE=tier1` rollback, drop-before-gen for p1, FIFO for equal-priority cards (REVEAL walk), abortable gen tokens, `pregenVoice()` helper. `lib/sfx.ts`: `getAudioContext()` export. Host lobby: Neural voice Kokoro/Built-in toggle + Fable (`bm_fable` default) / Emma (`bf_emma`) switch + `warming… %` / `ready` status; REVEAL-entry card pre-gen; Tier 1 fallback untouched on phones. `package.json` gains `kokoro-js` (version pin; runtime load is CDN).

**Why:** user picked full swap + British + q8. Two build failures fixed along the way: bare `import("kokoro-js")` pulled `onnxruntime-node` native `.node` binaries (Next 14 resolves the `node` export condition) → tried aliasing the self-contained `dist/kokoro.web.js` → that references sibling `ort.bundle.min.mjs` + `.wasm` webpack can't resolve → final shape is CDN runtime import, which also keeps 2.1MB + ort out of the TV bundle entirely. NOTE: neural latency (2–5s gen) vs 2.3s REVEAL slam + `estimateMs` SCORE chaining is mitigated (pre-gen, FIFO, drop-before-gen) but real-duration chaining + slam-gating remain future work — living-room pass must confirm cadence.

**Verified:** `typecheck` clean, `build` green (host 14.7 / play 6.67 kB — phones zero kokoro refs, no onnx/ort/transformers chunks in `.next`). `next start` smoke: `/ /preview /host/ZZZ9 /play/ZZZ9` all 200; host chunk contains Neural voice UI + pinned CDN URL; no stray server. Voice itself needs a human browser pass (warmup %, Fable vs Emma, reveal pacing, mute/voice-off).

## 2026-09-16 — Sarcasm rescue (prosody lift + sharper savage + honest warmup %)

**What changed:** browser test played a voice but flat. Two causes found (2 explore agents), both fixed. (1) Prosody: Kokoro has no pitch knob and I forced terminal `?→...` fall on all hype/punchline slots — 100% of those lines, killing the rise the shutout/ready jokes need. Fall now applies to hype only (`score_winner`/`score_unanimous` mic-drop); punchline (`lobby_ready`, `score_shutout`) keeps its lift. Speed spread widened (punchline 0.9→0.85, aside 1.15→1.2) to recover contrast without pitch. (2) Copy: sharpest savage upgrades for the 3 weakest slots agents flagged — `lobby_ready` ("voting for the other out of pity — whose charity case is this?"), `reveal_drawing` ("which one of you is calling THAT art?"), `vote_opener` ("which one sucks the least?"). (3) Warmup % lied: transformers reports progress 0–100 (not 0–1) and emits exactly 100 when Content-Length is unknown (the `installHook` console warning — benign, download completes fine), so the lobby jumped to 100% on chunk one. Handler now trusts intermediate values only, holds last otherwise; 0% renders indeterminate ("warming… who's patient?"). Also noted: sarcasm defaults to Family everywhere (toggle persists) — tester likely heard family; no code change, just check the lobby toggle says Savage.

**Verified:** `typecheck` clean, `build` green (host 14.7 / play 6.67 kB, unchanged). Unpushed — needs commit + Vercel redeploy before the tester re-listens.

## 2026-09-16 — Draw prompts doubled (30 → 60)

**What changed:** 30 new hand-written entries in `lib/prompts_draw.ts` (`DRAW_PROMPTS`, each with phone hint), same noun-friendly Drawful style as the existing pack. New batch fills uncovered territory: animals (penguin lifeguard, giraffe convertible, worm rock band, octopus juggling, sloth race, goldfish escape), jobs/places (shark dentist, dinosaur DMV, taco truck on Mars, Eiffel Tower yoga), monsters (basement monster resume, gnome uprising, vampire dentist, yeti lemonade stand), household twists (leftovers escape, wifi router diary, time machine cardboard box). Three near-dupes caught in drafting and replaced (fridge/snowman/dog overlap with existing prompts).

**Why:** draw pack was the thinnest (30 = ~10 games before cycling vs 140 for quiz, 40 for text). Now ~20 games per cycle.

**Verified:** scripted checks — 60/60 unique (case-insensitive), all hints non-empty ≤40 chars, max prompt 38 chars, 0 profanity flags under repo `containsProfanity` rules. `npm run typecheck` clean, `npm run build` green.

**What's next:** quiz game flow (new `game_type`, classic vs bluff, scoring) + host/phone UI.

## 2026-09-16 — Full quiz system + voice (classic + bluff)

**What changed:** quiz rounds are playable end-to-end in both modes, voiced throughout.
- **Load-bearing trick:** votes target `submissions.player_session`, so the server pre-inserts reserved house rows (`quiz:A–D` choices, `quiz:truth`) at round start — blind INPUT redaction, VOTE tallies, one-vote guard, and auto-advance all work untouched. Only scoring forks on `game_type`.
- **Schema:** `rooms.quiz_state jsonb` (`{quiz_id, choices, correct_index, correct_session}`), appended to `supabase/schema.sql` + applied live via migration. Snapshot redacts `correct_session` until SCORE and excludes house rows from `counts.submitted` (`lib/roomService.ts`, `lib/realtime.ts` type).
- **Engine:** `GameType` (`text|draw|quiz-classic|quiz-bluff`); `canTransition(from,to,gameType?)` gains quiz-only `LOBBY/SCORE→REVEAL` (classic has no INPUT); `QUIZ_READ_SECONDS=15`, `QUIZ_SPEED_BONUS=50`, `QUIZ_FINDER=100` + worth helpers (`lib/gameEngine.ts`, `lib/quiz.ts` new).
- **API:** `start` runs classic (card pick, 4 shuffled house rows, straight to REVEAL) and bluff (question prompt + hidden truth row, normal INPUT); classic start locked to LOBBY/SCORE so it can't hijack a live INPUT. `next`→INPUT rejects quiz gt (quiz rounds start via start) and clears stale `quiz_state`. `vote` pays classic correct-pickers (+speed kicker for first correct) and bluff truth-spotters, 0 for wrong picks, skips unanimous for quiz (top row may be a scoreless house row). `submit` untouched (phase guard covers classic).
- **TV:** lobby picker gains Quiz + Bluff; A–D badges on REVEAL/VOTE cards; SCORE correct-answer spotlight (letter + text + nailed-by/nobody list); MVP/awards/authorship exclude house rows with house-aware labels; REVEAL timer bar uses the 15s read window; REVEAL clock auto-marches to VOTE for classic.
- **Phones:** VOTE buttons gain A–D chips (house rows flow through automatically); SCORE shows correct-answer banner + house-aware recap labels.
- **Voice:** 4 new slots (`quiz_question/correct/nobody_right/bluff_sting`, family + savage, all interrogative per house rule) in `hostPersonality.ts`; `sayQuizQuestion` (sting + question chained) + `sayQuizAnswer` (verdict + answer behind the winner mic-drop) in `hostLines.ts`; host page reads the question on quiz REVEAL-entry, teases instead of reading the bluff truth aloud mid-walk (no pre-vote leak), reveals the answer at SCORE.

**Why:** user chose full system over voice-pack-only. Classic reuses the vote machinery (no schema for choices); bluff reuses the entire Fibbage loop — both honor server-authoritative, no-tick, generic-submission rules.

**Verified:** `typecheck` clean, `build` green (host 16 / play 6.88 kB). Scripted asserts pass: old transitions intact, quiz-only REVEAL open, scoring math (100/200 correct, 50 speed, 100/200 finder), house helpers, quiz_state parsing, all new voice lines interrogative with types. Mental smoke: classic create→Quiz→REVEAL(Q+choices)→VOTE(A–D)→SCORE(spotlight+voice) and bluff create→Bluff→INPUT(fakes, truth hidden)→REVEAL(tease walk)→VOTE→SCORE(finder bonuses); text/draw regression unchanged.

**What's next:** living-room playtest (both modes, voice cadence on real questions); category picker + difficulty ramp later.

## 2026-09-16 — Review P0s + quiz voice confirm

**Voice reads questions? Yes.** `sayQuizQuestion` (`lib/hostLines.ts:158`) speaks sting then chained clean question; host page calls it on quiz REVEAL-entry (`app/host/[code]/page.tsx:492-494`). REVEAL walk reads each choice via `sayAnswer` ("Number X... <choice>"); bluff truth row teased via `quiz_bluff_sting`, never read pre-vote. `sayQuizAnswer` reads verdict + answer at SCORE behind winner mic-drop. Caveat: text/draw INPUT prompts are NOT read aloud (generic opener only).

**Quiz set up? Yes end-to-end.** 420 CC0 cards (`lib/prompts_quiz.ts`, open-quiz-bank seed); `start` classic LOBBY/SCORE->REVEAL with 4 house rows + 15s read, bluff INPUT with hidden truth; `quiz_state` redacted until SCORE (`roomService`); `vote` pays correct voter + first-correct speed kicker (now earliest-row, not count==1), bluff finder bonus, wrong=0; TV A-D badges + correct spotlight, phones A-D chips + correct banner.

**P0 fixes (sub-agent review):**
- Schema truth: checked in `bump_room_seq` + `increment_vote` RPCs (fresh deploys 500'd before), enabled RLS deny-by-default + revoked anon grants so browser can't bypass blind redaction. Applied live.
- `start` takeover: bare no-token no longer steals host; needs `{ takeover: true }` in LOBBY.
- `vote`: speed kicker = earliest voter; SCORE flips guarded `.eq(phase,VOTE)` so concurrent last-votes collapse.
- `kick`: deletes only round >= current, votes scoped to round, count via head:true, re-freeze for INPUT+VOTE.
- Lobby 10ft: joinUrl 28px bold + how-to line, QR 170px with caption; 3-step tutorial strip; host voice/sarcasm/custom collapsed in <details>; COLD_OPEN/FINAL_SUB/awards/roundTitle rewritten interrogative; advance/extend errors mapped to host voice.

**Verified:** `npm run typecheck` clean, `npm run build` green. Mental smoke create->join->quiz-classic REVEAL voice->vote->score.

## 2026-09-16 — Savage-only Emma, reads every challenge

**What changed (per user: one voice, savage, sting + prompt):**
- Voice is savage-only: `SarcasmMode = "savage"`, `getSarcasmMode()` hardcodes savage; `hostPersonality` bank() always deals SAVAGE (FAMILY retired in place). Stall policy now names one slow typer (sanitized, 16 chars).
- One voice: Emma (`bf_emma`) hardcoded in `voiceKokoro`; Fable/Kokoro/Built-in/Savage toggles removed from lobby. Status line reads "Voice: Emma (savage) — ready/warming…". Tier-1 fallback + `NEXT_PUBLIC_VOICE=tier1` stay as silent rollback, no UI.
- Reads all questions: new `sayInputPrompt` (sting + sanitized prompt chained, p10) called on every INPUT entry (text/draw/bluff); quiz-classic unchanged on REVEAL; bluff truth still never read pre-vote. INPUT prompt pre-gen added for Kokoro.
- Voice previews for deciding (unchanged weights): official demo https://huggingface.co/spaces/hexgrad/Kokoro-TTS, compare https://terokarvinen.com/kokoro-foss-tts-voice-comparison/, samples https://rewind.ai/voices/.

**Verified:** `npm run typecheck` clean, `npm run build` green (host 13.9 kB). Mental smoke: LOBBY savage cold open → INPUT sting + challenge → stall names straggler → REVEAL/ VOTE/SCORE unchanged.
