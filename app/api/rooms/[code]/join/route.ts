import { NextResponse } from "next/server";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { name, session_id } = await req.json();
  if (!name || !session_id) return NextResponse.json({ error: "name + session_id required" }, { status: 400 });
  const admin = supabaseAdmin();
  const { error } = await admin
    .from("players")
    .upsert({ room_code: code, session_id, name }, { onConflict: "room_code,session_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
