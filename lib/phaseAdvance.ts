// Server-side timer expiry. The TV tab used to be the only auto-advance:
// if it slept, every phone parked at 0s. Now any client (phone or TV) can
// POST /api/rooms/[code]/tick when its local countdown hits zero, and the
// daily cleanup cron sweeps any rooms the clients missed. All advances are
// engine-gated (canTransition) + conditional on the expected phase so
// concurrent ticks/votes collapse to one flip. No per-second ticks —
// single ends_at comparisons only.

import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";
import { canTransition, revealSeconds, VOTE_SECONDS, type Phase } from "@/lib/gameEngine";

const EXPIRABLE: Phase[] = ["INPUT", "REVEAL", "VOTE"];

function isExpired(endsAt: unknown): boolean {
  if (typeof endsAt !== "string" || !endsAt) return false;
  return new Date(endsAt).getTime() <= Date.now();
}

type RoomRow = Record<string, unknown> & {
  code: string;
  phase: Phase;
  game_type?: string | null;
  ends_at?: string | null;
  current_round?: number | null;
};

/** Advance one room if its clock expired. Returns true when it flipped. */
export async function expireRoomByCode(code: string): Promise<boolean> {
  const admin = supabaseAdmin();
  const { data } = await admin.from("rooms").select("*").eq("code", code.toUpperCase()).single();
  const room = data as RoomRow | null;
  if (!room || !EXPIRABLE.includes(room.phase) || !isExpired(room.ends_at)) return false;

  const to: Phase = room.phase === "INPUT" ? "REVEAL" : room.phase === "REVEAL" ? "VOTE" : "SCORE";
  if (!canTransition(room.phase, to, (room.game_type as string | null) ?? null)) return false;

  const patch: Record<string, unknown> = { phase: to };
  if (to === "REVEAL") {
    const { count } = await admin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("room_code", room.code)
      .eq("round", room.current_round ?? 0);
    patch.ends_at = new Date(Date.now() + revealSeconds(count ?? 0) * 1000).toISOString();
    patch.input_total = null;
  } else if (to === "VOTE") {
    patch.ends_at = new Date(Date.now() + VOTE_SECONDS * 1000).toISOString();
  } else {
    // VOTE expiry with partial votes: flip as-is (no unanimous kicker —
    // that stays on the full-vote path in vote/route.ts).
    patch.ends_at = null;
    patch.input_total = null;
  }

  // Conditional write: concurrent ticks / vote auto-advance collapse to one.
  const { data: updated, error } = await admin
    .from("rooms")
    .update(patch)
    .eq("code", room.code)
    .eq("phase", room.phase)
    .select("code");
  if (error || !updated || updated.length === 0) return false;
  await bumpSeq(room.code);
  await broadcastRoom(room.code, await getSnapshot(room.code));
  return true;
}

/** Cron sweep: expire every room whose clock passed. Bounded, best-effort. */
export async function expireStuckRooms(limit = 20): Promise<number> {
  const admin = supabaseAdmin();
  const { data: rooms } = await admin
    .from("rooms")
    .select("code")
    .in("phase", EXPIRABLE)
    .lt("ends_at", new Date().toISOString())
    .limit(limit);
  if (!rooms || rooms.length === 0) return 0;
  let flipped = 0;
  for (const r of rooms as { code: string }[]) {
    try {
      if (await expireRoomByCode(r.code)) flipped++;
    } catch {}
  }
  return flipped;
}
