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
