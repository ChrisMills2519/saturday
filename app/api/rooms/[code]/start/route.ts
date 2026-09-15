import { NextResponse } from "next/server";
import { canTransition, type Phase } from "@/lib/gameEngine";
import { randomPrompt } from "@/lib/prompts";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot } from "@/lib/roomService";

// Host starts a round. Timer = single ends_at timestamp, phones count down locally.
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { prompt } = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  if (!canTransition(room.phase as Phase, "INPUT"))
    return NextResponse.json({ error: `bad transition ${room.phase} -> INPUT` }, { status: 400 });
  const endsAt = new Date(Date.now() + 60_000).toISOString();
  const { error } = await admin
    .from("rooms")
    .update({
      phase: "INPUT",
      prompt: prompt ?? randomPrompt(room.prompt),
      ends_at: endsAt,
      current_round: (room.current_round ?? 0) + 1,
    })
    .eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
