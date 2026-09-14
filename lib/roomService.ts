import { supabaseAdmin } from "@/lib/supabase";

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
  return {
    code: room.code,
    phase: room.phase,
    prompt: room.prompt,
    ends_at: room.ends_at,
    players: players ?? [],
    submissions: submissions ?? [],
    scores: room.scores ?? {},
  };
}
