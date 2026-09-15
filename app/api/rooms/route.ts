import { NextResponse } from "next/server";
import { makeRoomCode, makeHostToken } from "@/lib/gameEngine";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { purgeExpiredRooms } from "@/lib/roomCleanup";
import { getSnapshot } from "@/lib/roomService";

export async function POST(req: Request) {
  const admin = supabaseAdmin();
  // Opportunistic TTL: keeps the tables bounded even if Vercel Cron misses
  // (forks, hobby limits). Best-effort, never fails room creation.
  await purgeExpiredRooms(admin);
  const { total_rounds, game_type } = await req.json().catch(() => ({} as Record<string, unknown>));
  const rounds =
    typeof total_rounds === "number" && Number.isFinite(total_rounds)
      ? Math.min(9, Math.max(1, Math.floor(total_rounds)))
      : 3;
  const gt = game_type === "draw" ? "draw" : "text";
  const code = makeRoomCode();
  const host_token = makeHostToken();
  const basePayload: Record<string, unknown> = {
    code,
    phase: "LOBBY",
    game_type: gt,
    total_rounds: rounds,
    host_token,
  };
  // Tolerant of missing columns on live DB before migration is applied.
  let { error } = await admin.from("rooms").insert(basePayload);
  if (error?.message?.match?.(/host_token|game_type|round_history|used_prompts|input_total|prompt_hint/i)) {
    const fallback: Record<string, unknown> = { code, phase: "LOBBY", total_rounds: rounds };
    // only send columns known to the old schema
    const res2 = await admin.from("rooms").insert(fallback);
    error = res2.error;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const room = await getSnapshot(code);
  await broadcastRoom(code, room);
  return NextResponse.json({ ...room, host_token });
}
