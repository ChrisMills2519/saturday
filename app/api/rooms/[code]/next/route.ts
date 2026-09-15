import { NextResponse } from "next/server";
import { canTransition, type Phase } from "@/lib/gameEngine";
import { randomPrompt } from "@/lib/prompts";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { to, prompt } = await req.json();
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  if (!canTransition(room.phase as Phase, to as Phase))
    return NextResponse.json({ error: `bad transition ${room.phase} -> ${to}` }, { status: 400 });
  const patch: Record<string, unknown> = { phase: to };
  if (to === "INPUT") {
    patch.current_round = (room.current_round ?? 0) + 1;
    patch.prompt = prompt ?? randomPrompt(room.prompt);
    patch.ends_at = new Date(Date.now() + 60_000).toISOString();
  } else {
    // No stale "0s" timers on TV/phones after INPUT ends.
    patch.ends_at = null;
  }
  if (to === "LOBBY") patch.ends_at = null;
  if (to === "LOBBY") {
    // Rematch: same code, clean slate. Per-round rows stay in the DB but
    // the snapshot only ever reads the current round, so a scores reset
    // + round 0 is all a fresh game needs.
    patch.ends_at = null;
    patch.scores = {};
    patch.current_round = 0;
    patch.prompt = null;
  }
  const { error } = await admin.from("rooms").update(patch).eq("code", code);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
