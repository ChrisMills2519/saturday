# Saturday — Family Party Bones

Phone-as-controller party game bones: laptop = TV host screen, phones = controllers, no app install. Server lives on Vercel + Supabase so remote family can join over the internet.

## How it works

```
TV (/host/CODE) <---> Next.js API + Supabase Broadcast <---> Phones (/play/CODE)
```

- Host creates a room → 4-letter code (no 0/O/1/I) + QR to `/play/CODE`.
- Phones join with name (UUID in `localStorage`, no login). Max 8 players; duplicate names get `(2)`, family-safe names/answers enforced server-side.
- Host starts → prompt on phones → submit → reveal on TV → vote → scores. Two game modes picked in the lobby: **Write** (text) or **Draw** (finger-paint pad).
- Scoring: `100` per vote, **final round doubles**, `+250` clean-sweep bonus (every other player picked the same answer). Vote history shows per-round deltas on phones.
- Realtime: one Broadcast channel per room (`room:CODE`, event `room_updated`). Timers send `ends_at` once; phones count down locally — no per-second server ticks (saves Supabase quota).
- Prompts: 120 text cards in 8 packs + 30 draw prompts. No repeats within a room (`used_prompts`), each with a phone hint so nobody faces a blank page.
- `submissions.image_url` carries Drawful-style drawings (canvas data URL, submitted once). Text games use `text_content`.
- Host-only controls (start/next/kick/extend) use a per-room `host_token` kept in the creating browser's `localStorage`; enforced once the game leaves LOBBY.

## Local run

1. Supabase → SQL Editor → run `supabase/schema.sql` → expect `Success. No rows returned`. Safe to re-run; it includes `alter table ... add column if not exists` for rooms created before the 2026-09-15 upgrades (`prompt_hint`, `used_prompts`, `input_total`, `host_token`, `round_history`).
2. Copy `.env.example` to `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL (`https://<ref>.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = publishable key (`sb_publishable_...`)
   - `SUPABASE_SERVICE_ROLE_KEY` = secret key (server-only, never `NEXT_PUBLIC_`, never share)
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
3. `npm install && npm run dev`
4. Smoke test: Tab 1 `/` → Create room → `/host/CODE`. Tab 2 incognito → `/play/CODE` → join → Start → submit → Reveal → Voting → Scores.

## Deploy (internet play for Saturday)

1. Push to GitHub → Import to Vercel.
2. Vercel env vars: same 4 as above, but `NEXT_PUBLIC_APP_URL=https://your-app.vercel.app` so the TV QR points where phones can reach.
3. Test: laptop on WiFi (host) + one phone on mobile data (not WiFi).

## Saturday night

Laptop `/host/CODE` → HDMI to TV (in-person) or screenshare the tab on Zoom/Discord (remote). Phones scan QR → `/play/CODE`.

## Next

Audience mode (late joiners vote at half weight), Storage upload for large drawings, per-prompt custom host input, team play.
