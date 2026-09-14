# Saturday — Family Party Bones

Phone-as-controller party game bones: laptop = TV host screen, phones = controllers, no app install. Server lives on Vercel + Supabase so remote family can join over the internet.

## How it works

```
TV (/host/CODE) <---> Next.js API + Supabase Broadcast <---> Phones (/play/CODE)
```

- Host creates a room → 4-letter code (no 0/O/1/I) + QR to `/play/CODE`.
- Phones join with name (UUID in `localStorage`, no login).
- Host starts → prompt on phones → submit → reveal on TV → vote → scores.
- Realtime: one Broadcast channel per room (`room:CODE`, event `room_updated`). Timers send `ends_at` once; phones count down locally — no per-second server ticks (saves Supabase quota).
- `submissions.image_url` is reserved for Drawful-style drawing v2. Text games use `text_content`.

## Local run

1. Supabase → SQL Editor → run `supabase/schema.sql` → expect `Success. No rows returned`.
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

## Next (not in bones)

Canvas input submitting `image_url`, Storage upload for large drawings, double-vote guard, profanity filter, kick/reconnect.
