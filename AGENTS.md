# AGENTS.md — Saturday Party Game

## What this is
Jackbox-style family party game. Laptop browser = TV host screen (`/host/[code]`), phones = controllers (`/play/[code]`), no app install. Server = Next.js API routes + Supabase (Postgres + Realtime Broadcast). Internet play via Vercel; laptop is never the server.

## Commands
- `npm install` — install
- `npm run dev` — local dev (needs `.env.local`, see `.env.example`)
- `npm run typecheck` — `tsc --noEmit`, keep clean
- `npm run build` — must stay green before claiming done
- Schema: run `supabase/schema.sql` in Supabase SQL Editor, expect `Success. No rows returned`

## Architecture rules (load-bearing)
1. **Server-authoritative only.** All writes go through `app/api/rooms/...` using `supabaseAdmin()` (service_role). Browser clients subscribe via `useRoom()` and never broadcast directly. Every state change ends with `broadcastRoom(code, snapshot)`.
2. **Phases go through the engine.** `lib/gameEngine.ts` `VALID_TRANSITIONS`: LOBBY→INPUT→REVEAL→VOTE→SCORE→INPUT/LOBBY. API routes must call `canTransition()`; bad jumps return 400.
3. **No per-second server ticks.** Broadcast `ends_at` once; phones use `useCountdown()` locally. Per-tick broadcasts blow Supabase Realtime quotas.
4. **Submissions are generic.** `submit` accepts `text_content` OR `image_url` (drawing v2). Don't fork the flow per game — switch on `game_type`/rendering only.
5. **Room codes:** 4 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I), uppercase. Identity = UUID in `localStorage` (`getSessionId()`), upsert on join for reconnects.

## File map
- `app/page.tsx` — create/join | `app/host/[code]/page.tsx` — TV | `app/play/[code]/page.tsx` — phone
- `app/api/rooms/route.ts` + `app/api/rooms/[code]/{route,join,start,submit,vote,next}/route.ts`
- `lib/{gameEngine,supabase,realtime,roomService}.ts` | `supabase/schema.sql` | `README.md` | `DEVLOG.md`

## Never do
- Never commit `.env.local` or any secret; never add `NEXT_PUBLIC_` to the service_role key; never paste secrets in chat/logs.
- Never read tables directly from browser code (`from("rooms")` etc. belongs in API routes + `roomService.ts` only).
- Never add polling faster than the 3s broadcast-miss fallback in `useRoom`, never stream canvas strokes per-mousemove (drawing submits once).
- Never create docs files proactively beyond what the user asked; update `DEVLOG.md` (append entry) when behavior changes.

## Asset fetching permission (standing)
- Standing permission to download internet assets whenever needed for the game — no need to ask per-file.
- Prefer CC0 (OpenGameArt CC0 badge, Kenney.nl). Pixabay Content License OK for game use (no attribution, no standalone redistribution); scripted CDN download allowed via `curl_cffi` chrome impersonation (Pixabay pages are Cloudflare-blocked for curl/cloudscraper — see scraper notes in DEVLOG 2026-09-15) — human verifies license per track, record page + CDN URL. No NC/ND, no attribution-required packs vendored without noting it.
- Static assets only in `public/images/`, `public/audio/`, `public/fonts/` — never executables, scripts, or HTML. Verify each file: `file <path>` + size sanity (<1MB per SFX/image, <1.5MB per music loop), then `npm run typecheck` + `npm run build`.
- Record provenance in `public/{audio,images}/README.md` (source URL, license, edits like mono/-14 LUFS/fades) and append a `DEVLOG.md` entry. Never commit secrets alongside assets.

### Audio source list (music + SFX)
- Tier 1 CC0, scriptable: OpenGameArt (per-page CC0 badge check — site also hosts CC-BY), Kenney.nl packs (direct zips), FreePD GitHub mirror (`0lhi/FreePD`), Wikimedia Commons (CC0/PD filter, MediaWiki API), Freesound CC0 previews (free API key; full WAV needs login), Chiptone/jsfxr generators (CC0 output, fully offline).
- Tier 2 CC0, manual download: John Bartmann Albums One & Two only (FMA login-walled; rest of his catalog is CC-BY, do not touch).
- Tier 3 royalty-free no-attribution, scriptable CDN only (pages blocked, see above): Pixabay Music/SFX, Coverr (no signup, static links), Mixkit SFX only (its music bans game use), Sonniss GDC bundles (quality backup).
- Reject: Mixkit music / Tunetank free / Purple Planet free (all exclude games), NCS (UGC-video only), Epidemic (paid), YouTube Audio Library (YouTube only), BBC RemArc (non-commercial), anything attribution-required (Bensound, Soundimage, Incompetech, ccMixter, Uppbeat-free, ZapSplat-free).

## Before finishing
Run `npm run typecheck` + `npm run build`, smoke-test create→join→submit→vote mentally against the API, and append a `DEVLOG.md` entry (date, change, why, verification).
