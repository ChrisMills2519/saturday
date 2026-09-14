import { NextResponse } from "next/server";
import { makeRoomCode } from "@/lib/gameEngine";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot } from "@/lib/roomService";

export async function POST() {
  const admin = supabaseAdmin();
  const code = makeRoomCode();
  const { error } = await admin.from("rooms").insert({ code, phase: "LOBBY" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const room = await getSnapshot(code);
  await broadcastRoom(code, room);
  return NextResponse.json(room);
}
