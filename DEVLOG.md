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
