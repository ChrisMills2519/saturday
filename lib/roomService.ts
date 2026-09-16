import { supabaseAdmin } from "@/lib/supabase";

// Atomic monotonic bump per mutation via SQL function.
// Prevents lost increments under concurrent mutations (two players
// submitting at the same instant).
export async function bumpSeq(code: string): Promise<number> {
  const admin = supabaseAdmin();
  const { data } = await admin.rpc("bump_room_seq", { p_code: code });
  return (data as number) ?? 0;
}

function safeArray(j: unknown): string[] {
  if (Array.isArray(j)) return j as string[];
  return [];
}
function safeMap(j: unknown): Record<string, Record<string, number>> {
  if (j && typeof j === "object" && !Array.isArray(j)) return j as Record<string, Record<string, number>>;
  return {};
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
  // Blind VOTE: answers are visible (that's the point of voting) but
  // per-answer tallies + running scores stay hidden until SCORE so
  // nobody can bandwagon off devtools. Only counts.voted (N/M) is shown.
  const blind = room.phase === "INPUT";
  const voteBlind = room.phase === "VOTE";
  const subs = blind
    ? rows.map((s) => ({ ...s, text_content: null, image_url: null }))
    : voteBlind
      ? rows.map((s) => ({ ...s, votes: 0 }))
      : rows;
  const voted = rows.reduce((n, s) => n + (s.votes ?? 0), 0);
  // Who-voted-for-who is only exposed at SCORE (VOTE stays blind). Powers the
  // TV "who picked what" recap + awards without leaking live tallies.
  let votesDetail: { voter_session: string; target_session: string }[] = [];
  if (room.phase === "SCORE") {
    const { data: voteRows } = await admin
      .from("votes")
      .select("voter_session,target_session")
      .eq("room_code", code)
      .eq("round", room.current_round);
    votesDetail = (voteRows ?? []) as { voter_session: string; target_session: string }[];
  }
  const inputTotal = (room.input_total as number | null) ?? null;
  // Denominator during INPUT/VOTE should be the frozen input_total when present,
  // but keep live total for LOBBY/SCORE so rematch/join counts feel immediate.
  const denom = (room.phase === "INPUT" || room.phase === "VOTE") && inputTotal != null ? inputTotal : (players ?? []).length;
  return {
    code: room.code,
    phase: room.phase,
    prompt: room.prompt,
    prompt_hint: (room.prompt_hint as string | null) ?? null,
    ends_at: room.ends_at,
    current_round: room.current_round ?? 0,
    total_rounds: room.total_rounds ?? 3,
    game_type: room.game_type ?? "text",
    // host_token is deliberately NOT in the snapshot: GET /api/rooms/[code] is
    // public, so leaking it would defeat the guard. The creating browser keeps
    // its own copy in localStorage (see lib/hostToken.ts).
    seq: room.seq ?? 0,
    players: players ?? [],
    submissions: subs,
    counts: { submitted: rows.length, voted, total: denom, input_total: inputTotal },
    scores: voteBlind ? {} : (room.scores ?? {}),
    votes_detail: votesDetail,
    round_history: safeMap((room as unknown as Record<string, unknown>).round_history),
    used_prompts: safeArray((room as unknown as Record<string, unknown>).used_prompts),
  };
}
