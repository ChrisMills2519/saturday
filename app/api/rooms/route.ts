import { NextResponse } from "next/server";
import { makeRoomCode, makeHostToken } from "@/lib/gameEngine";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { purgeExpiredRooms } from "@/lib/roomCleanup";
import { getSnapshot } from "@/lib/roomService";

const MAX_CODE_RETRIES = 5;

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
  const host_token = makeHostToken();

  // Retry loop for 4-char code collisions (~1 in 1.1M, but easy to handle).
  let lastError: string | null = null;
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
    const code = makeRoomCode();
    const basePayload: Record<string, unknown> = {
      code,
      phase: "LOBBY",
      game_type: gt,
      total_rounds: rounds,
      host_token,
    };
    let { error } = await admin.from("rooms").insert(basePayload);
    if (error?.message?.match?.(/host_token|game_type|round_history|used_prompts|input_total|prompt_hint/i)) {
      const fallback: Record<string, unknown> = { code, phase: "LOBBY", total_rounds: rounds };
      const res2 = await admin.from("rooms").insert(fallback);
      error = res2.error;
    }
    if (!error) {
      const room = await getSnapshot(code);
      await broadcastRoom(code, room);
      return NextResponse.json({ ...room, host_token });
    }
    lastError = error.message;
    // If it's not a PK collision, don't retry
    if (!error.message?.includes("duplicate") && !error.message?.includes("23505")) break;
  }
  return NextResponse.json({ error: lastError ?? "failed to create room" }, { status: 500 });
}
