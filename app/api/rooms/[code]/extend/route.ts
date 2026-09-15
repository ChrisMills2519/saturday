import { NextResponse } from "next/server";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";

// POST /api/rooms/:code/extend  — host needs +30s.
// Body: {} optional seconds (default 30, max 60), clamped so a round never exceeds 3 min from now.
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { seconds } = await req.json().catch(() => ({} as Record<string, unknown>));
  const headerToken = req.headers.get("x-host-token");
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  if ((room as Record<string, unknown>).host_token && headerToken !== (room as Record<string, unknown>).host_token)
    return NextResponse.json({ error: "host token required" }, { status: 403 });
  if (room.phase !== "INPUT" && room.phase !== "VOTE")
    return NextResponse.json({ error: `nothing to extend in ${room.phase}` }, { status: 400 });
  const add = Math.min(60, Math.max(10, Number.isFinite(seconds as number) ? Math.floor(seconds as number) : 30));
  const baseMs = room.ends_at ? new Date(room.ends_at as string).getTime() : Date.now();
  const nextEnds = new Date(Math.max(Date.now(), baseMs) + add * 1000).toISOString();
  // cap: phase shouldn't run more than ~3m total
  const cap = new Date(Date.now() + 180_000).toISOString();
  const ends_at = new Date(nextEnds).getTime() > new Date(cap).getTime() ? cap : nextEnds;
  const { error } = await admin.from("rooms").update({ ends_at }).eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true, ends_at });
}
