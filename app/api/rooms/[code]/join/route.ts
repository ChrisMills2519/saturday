import { NextResponse } from "next/server";
import { MAX_PLAYERS } from "@/lib/gameEngine";
import { sanitizeName, rejectReasonForName, rejectReasonForSession, dedupeName } from "@/lib/validation";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { name, session_id } = await req.json();
  if (!name || !session_id) return NextResponse.json({ error: "name + session_id required" }, { status: 400 });
  const why = rejectReasonForName(String(name));
  if (why) return NextResponse.json({ error: why }, { status: 400 });
  const whySession = rejectReasonForSession(session_id);
  if (whySession) return NextResponse.json({ error: whySession }, { status: 400 });
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  const { data: players } = await admin.from("players").select("session_id,name").eq("room_code", code);
  const live = players ?? [];
  // Max players (8): existing session can re-join, new session cannot once full.
  const already = live.some((p) => p.session_id === session_id);
  if (!already && live.length >= MAX_PLAYERS)
    return NextResponse.json({ error: "room full (8 max)" }, { status: 400 });
  // Late joins become spectators during a running game (they can vote, but can't submit this round).
  // Still allow the join row so they're in the room for the next round.
  const taken = new Set(live.filter((p) => p.session_id !== session_id).map((p) => p.name));
  const finalName = dedupeName(sanitizeName(String(name)), taken);
  const { error } = await admin
    .from("players")
    .upsert({ room_code: code, session_id, name: finalName }, { onConflict: "room_code,session_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true, name: finalName });
}
