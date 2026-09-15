import { supabaseAdmin } from "@/lib/supabase";

// Monotonic bump per mutation. Read-then-write is fine for party scale
// (a handful of phones, one room); the column exists so clients can
// drop out-of-order broadcasts, not for strict serialization.
export async function bumpSeq(code: string): Promise<number> {
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("seq").eq("code", code).single();
  const next = ((room?.seq as number) ?? 0) + 1;
  await admin.from("rooms").update({ seq: next }).eq("code", code);
  return next;
}

export async function getSnapshot(code: string) {
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return null;
  const { data: players } = await admin.from("players").select("session_id,name").eq("room_code", code);
  const { data: submissions } = await admin
    .from("submissions")
    .select("player_session,text_content,image_url,votes")
    .eq("room_code", code)
    .eq("round", room.current_round);
  const rows = submissions ?? [];
  // Blind INPUT: roster sees WHO locked in (player_session) but never
  // WHAT (text/image). Kills devtools spoilers; server-enforced.
  const blind = room.phase === "INPUT";
  const subs = blind
    ? rows.map((s) => ({ ...s, text_content: null, image_url: null }))
    : rows;
  const voted = rows.reduce((n, s) => n + (s.votes ?? 0), 0);
  return {
    code: room.code,
    phase: room.phase,
    prompt: room.prompt,
    ends_at: room.ends_at,
    current_round: room.current_round ?? 0,
    seq: room.seq ?? 0,
    players: players ?? [],
    submissions: subs,
    counts: { submitted: rows.length, voted, total: (players ?? []).length },
    scores: room.scores ?? {},
  };
}
