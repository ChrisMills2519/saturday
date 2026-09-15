import { NextResponse } from "next/server";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot } from "@/lib/roomService";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { session_id, text_content, image_url } = await req.json();
  if (!session_id || (!text_content && !image_url))
    return NextResponse.json({ error: "session_id + text_content or image_url required" }, { status: 400 });
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  if (room.phase !== "INPUT")
    return NextResponse.json({ error: `submit only in INPUT (now ${room.phase})` }, { status: 400 });
  const { error } = await admin.from("submissions").upsert(
    { room_code: code, round: room.current_round, player_session: session_id, text_content: text_content ?? null, image_url: image_url ?? null },
    { onConflict: "room_code,round,player_session" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
