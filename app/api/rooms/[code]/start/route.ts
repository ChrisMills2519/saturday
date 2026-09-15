import { NextResponse } from "next/server";
import { canTransition, type Phase } from "@/lib/gameEngine";
import { randomPrompt } from "@/lib/prompts";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";

// Host starts a round. Timer = single ends_at timestamp, phones count down locally.
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { prompt, total_rounds } = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  if (!canTransition(room.phase as Phase, "INPUT"))
    return NextResponse.json({ error: `bad transition ${room.phase} -> INPUT` }, { status: 400 });
  // Voting needs someone else to vote for: solo starts would dead-end at VOTE.
  const { count: playerCount } = await admin
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("room_code", code);
  if ((playerCount ?? 0) < 2)
    return NextResponse.json({ error: "need 2+ players to start" }, { status: 400 });
  const endsAt = new Date(Date.now() + 60_000).toISOString();
  const { error } = await admin
    .from("rooms")
    .update({
      phase: "INPUT",
      prompt: prompt ?? randomPrompt(room.prompt),
      ends_at: endsAt,
      current_round: (room.current_round ?? 0) + 1,
      // Host may set length while still in LOBBY; clamped 1-9.
      ...(typeof total_rounds === "number" && Number.isFinite(total_rounds)
        ? { total_rounds: Math.min(9, Math.max(1, Math.floor(total_rounds))) }
        : {}),
    })
    .eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
