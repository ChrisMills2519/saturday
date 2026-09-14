import { NextResponse } from "next/server";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot } from "@/lib/roomService";

// One vote = +1 to submission +1 to author's score. Bones-simple, no double-vote guard yet.
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { target_session } = await req.json();
  if (!target_session) return NextResponse.json({ error: "target_session required" }, { status: 400 });
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  const { data: sub } = await admin
    .from("submissions")
    .select("*")
    .eq("room_code", code)
    .eq("round", room.current_round)
    .eq("player_session", target_session)
    .single();
  if (!sub) return NextResponse.json({ error: "no submission" }, { status: 404 });
  await admin.from("submissions").update({ votes: (sub.votes ?? 0) + 1 }).eq("id", sub.id);

  const { data: author } = await admin
    .from("players")
    .select("name")
    .eq("room_code", code)
    .eq("session_id", target_session)
    .single();
  const scores = (room.scores ?? {}) as Record<string, number>;
  if (author) scores[author.name] = (scores[author.name] ?? 0) + 1;
  await admin.from("rooms").update({ scores }).eq("code", code);

  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
