import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { purgeExpiredRooms } from "@/lib/roomCleanup";
import { expireStuckRooms } from "@/lib/phaseAdvance";

// Must stay dynamic: this route deletes based on now(), never cache it.
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // No secret configured: FAIL CLOSED. In production CRON_SECRET must be
  // set — without it the endpoint is unauthenticated and could wipe all rooms.
  // Local dev: set CRON_SECRET in .env.local to test.
  if (!expected) return false;
  const header = req.headers.get("authorization");
  return header === `Bearer ${expected}`;
}

async function handle(req: Request) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Sweep stuck clocks first so rooms abandoned with a sleeping TV still
  // advance, then purge dead weight.
  const expired = await expireStuckRooms(20);
  const deleted = await purgeExpiredRooms(supabaseAdmin());
  return NextResponse.json({ ok: true, expired, deleted });
}

// Vercel Cron issues GET; allow POST too for manual curl triggers.
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
