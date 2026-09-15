import { NextResponse } from "next/server";
import { UNANIMOUS_BONUS, voteWorth, isCleanSweep } from "@/lib/gameEngine";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";

// One voter = one vote per round. Votes tallied blind (hidden until SCORE).
// Scoring: +100 per vote (final round 2x) + unanimous kicker.
// Auto-advances VOTE→SCORE when every player has voted.
// Scores keyed by session_id; legacy name-keyed scores migrate lazily.
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

  // Single-vote guard.
  try {
    const { error: voteErr } = await admin.from("votes").insert({
      room_code: code,
      round: room.current_round,
      voter_session: session_id,
      target_session,
    });
    if (voteErr) {
      if ((voteErr as { code?: string }).code === "23505")
        return NextResponse.json({ error: "already voted" }, { status: 400 });
      throw voteErr;
    }
  } catch (e) {
    if ((e as { code?: string })?.code === "23505")
      return NextResponse.json({ error: "already voted" }, { status: 400 });
    const msg = (e as Error)?.message ?? "";
    if (!/votes|42P01|42703|PGRST/i.test(msg)) throw e;
  }

  await admin.from("submissions").update({ votes: (sub.votes ?? 0) + 1 }).eq("id", sub.id);

  const { data: players } = await admin.from("players").select("session_id,name").eq("room_code", code);
  const totalPlayers = (players ?? []).length;
  const rr = (room.current_round ?? 0);
  const tr = (room.total_rounds as number | null) ?? 3;
  const isFinal = rr >= tr;
  const pts = voteWorth(totalPlayers, isFinal);
  // The clean-sweep kicker is awarded below, once every player has voted and we
  // can see the final tally (everyone else picked the same answer).

  const raw = (room.scores ?? {}) as Record<string, number>;
  const scores: Record<string, number> = {};
  const byName = new Map((players ?? []).map((p) => [p.name, p.session_id]));
  for (const [k, v] of Object.entries(raw)) {
    const sid = byName.has(k) ? (byName.get(k) as string) : k;
    scores[sid] = (scores[sid] ?? 0) + (v ?? 0);
  }
  scores[target_session] = (scores[target_session] ?? 0) + pts;

  // Per-round delta for phone history + host MVP.
  const rhRaw = ((room as Record<string, unknown>).round_history as Record<string, Record<string, number>> | null) ?? {};
  const roundHist: Record<string, Record<string, number>> = typeof rhRaw === "object" && !Array.isArray(rhRaw) ? { ...rhRaw } : {};
  const key = String(rr);
  roundHist[key] = { ...(roundHist[key] ?? {}) };
  roundHist[key][target_session] = (roundHist[key][target_session] ?? 0) + pts;

  const roomPatch: Record<string, unknown> = { scores };
  let rhApplied = false;
  try {
    await admin.from("rooms").update({ ...roomPatch, round_history: roundHist }).eq("code", code);
    rhApplied = true;
  } catch {
    // before migration: round_history column doesn't exist yet
  }
  if (!rhApplied) await admin.from("rooms").update(roomPatch).eq("code", code);

  // Re-read voted count; if everyone has voted, flip to SCORE (clears clock).
  // At that moment award unanimous bonus to the winner if needed.
  try {
    const { data: rowsRaw } = await admin.from("submissions").select("votes,player_session").eq("room_code", code).eq("round", rr);
    type VoteRow = { votes: number | null; player_session: string };
    const rows: VoteRow[] = (rowsRaw ?? []) as VoteRow[];
    const voted = rows.reduce((n, r) => n + (r.votes ?? 0), 0);
    const enoughVotable = rows.length >= 2;
    if (enoughVotable && voted >= totalPlayers) {
      // unanimous: one answer has all votes
      const maxRow = rows.reduce<VoteRow | null>((m, r) => (!m || (r.votes ?? 0) > (m.votes ?? 0) ? r : m), null);
      if (maxRow && isCleanSweep(maxRow.votes ?? 0, totalPlayers)) {
        const fresh = await admin.from("rooms").select("scores, round_history").eq("code", code).single();
        const curScores = (fresh.data?.scores as Record<string, number> | null) ?? scores;
        const curHist = ((fresh.data as Record<string, unknown>)?.round_history as Record<string, Record<string, number>> | null) ?? roundHist;
        curScores[maxRow.player_session] = (curScores[maxRow.player_session] ?? 0) + UNANIMOUS_BONUS;
        const rh2: Record<string, Record<string, number>> = typeof curHist === "object" && !Array.isArray(curHist) ? { ...curHist } : {};
        rh2[key] = { ...(rh2[key] ?? {}) };
        rh2[key][maxRow.player_session] = (rh2[key][maxRow.player_session] ?? 0) + UNANIMOUS_BONUS;
        try {
          await admin.from("rooms").update({ scores: curScores, round_history: rh2, phase: "SCORE", ends_at: null, input_total: null }).eq("code", code);
        } catch {
          await admin.from("rooms").update({ scores: curScores, phase: "SCORE", ends_at: null }).eq("code", code);
        }
        await bumpSeq(code);
        await broadcastRoom(code, await getSnapshot(code));
        return NextResponse.json({ ok: true });
      }
      await admin.from("rooms").update({ phase: "SCORE", ends_at: null, input_total: null }).eq("code", code);
    }
  } catch { /* best-effort */ }

  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
