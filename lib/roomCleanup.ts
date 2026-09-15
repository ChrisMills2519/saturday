import type { SupabaseClient } from "@supabase/supabase-js";

// Rooms older than this are considered dead weight. Games last <1h, so 24h
// safely covers rematch + late rejoin while bounding table growth and
// 4-char code collision odds. ON DELETE CASCADE on players/submissions/
// votes means deleting the room row cleans up all children.
export const ROOM_TTL_HOURS = 24;

// Best-effort purge of expired rooms. Never throws — callers (room creation,
// cron) must not fail just because cleanup did.
export async function purgeExpiredRooms(admin: SupabaseClient): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - ROOM_TTL_HOURS * 3_600_000).toISOString();
    const { data, error } = await admin
      .from("rooms")
      .delete()
      .lt("created_at", cutoff)
      .select("code");
    if (error) return 0;
    return data?.length ?? 0;
  } catch {
    return 0;
  }
}
