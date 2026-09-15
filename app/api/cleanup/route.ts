import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { purgeExpiredRooms } from "@/lib/roomCleanup";

// Must stay dynamic: this route deletes based on now(), never cache it.
export const dynamic = "force-dynamic";

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  // No secret configured (local dev): allow. In prod Vercel env CRON_SECRET
  // must be set — Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  if (!expected) return true;
  const header = req.headers.get("authorization");
  return header === `Bearer ${expected}`;
}

async function handle(req: Request) {
  if (!isAuthorized(req))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const deleted = await purgeExpiredRooms(supabaseAdmin());
  return NextResponse.json({ ok: true, deleted });
}

// Vercel Cron issues GET; allow POST too for manual curl triggers.
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
