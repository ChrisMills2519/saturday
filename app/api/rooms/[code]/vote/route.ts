import { NextResponse } from "next/server";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";

// One voter = one vote per round. Votes tallied blind (hidden until SCORE).
// Scores keyed by session_id (stable across renames); legacy name-keyed
// scores migrate lazily on read.
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { session_id, target_session } = await req.json();
  if (!target_session) return NextResponse.json({ error: "target_session required" }, { status: 400 });
  if (!session_id) return NextResponse.json({ error: "session_id required" }, { status: 400 });
  if (session_id === target_session)
    return NextResponse.json({ error: "no self-vote" }, { status: 400 });
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  if (room.phase !== "VOTE")
    return NextResponse.json({ error: `vote only in VOTE (now ${room.phase})` }, { status: 400 });
  const { data: sub } = await admin
    .from("submissions")
    .select("*")
    .eq("room_code", code)
    .eq("round", room.current_round)
    .eq("player_session", target_session)
    .single();
  if (!sub) return NextResponse.json({ error: "no submission" }, { status: 404 });

  // Single-vote guard. If the votes table hasn't been created yet
  // (schema.sql not re-run), fall back to the old unguarded path
  // so the game still works.
  try {
    const { error: voteErr } = await admin.from("votes").insert({
      room_code: code,
      round: room.current_round,
      voter_session: session_id,
      target_session,
    });
    if (voteErr) {
      // 23505 = already voted this round.
      if ((voteErr as { code?: string }).code === "23505")
        return NextResponse.json({ error: "already voted" }, { status: 400 });
      throw voteErr;
    }
  } catch (e) {
    if ((e as { code?: string })?.code === "23505")
      return NextResponse.json({ error: "already voted" }, { status: 400 });
    // Missing table (42P01) or missing column: legacy fallback, still count it.
    const msg = (e as Error)?.message ?? "";
    if (!/votes|42P01|42703|PGRST/i.test(msg)) throw e;
  }

  await admin.from("submissions").update({ votes: (sub.votes ?? 0) + 1 }).eq("id", sub.id);

  const raw = (room.scores ?? {}) as Record<string, number>;
  const scores: Record<string, number> = {};
  // Lazy-migrate legacy name-keyed scores to session-keyed once.
  const { data: players } = await admin.from("players").select("session_id,name").eq("room_code", code);
  const byName = new Map((players ?? []).map((p) => [p.name, p.session_id]));
  for (const [k, v] of Object.entries(raw)) {
    const sid = byName.has(k) ? (byName.get(k) as string) : k;
    scores[sid] = (scores[sid] ?? 0) + (v ?? 0);
  }
  scores[target_session] = (scores[target_session] ?? 0) + 1;
  await admin.from("rooms").update({ scores }).eq("code", code);

  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
