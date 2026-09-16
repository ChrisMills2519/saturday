import { NextResponse } from "next/server";
import { UNANIMOUS_BONUS, voteWorth, isCleanSweep, quizCorrectWorth, quizSpeedBonus, quizFinderWorth } from "@/lib/gameEngine";
import { parseQuizState, isHouseSession, QUIZ_TRUTH_SESSION } from "@/lib/quiz";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";

// One voter = one vote per round. Votes tallied blind (hidden until SCORE).
// Scoring: +100 per vote (final round 2x) + unanimous kicker.
// Quiz fork: choices/truth live in house submissions (quiz:*). Classic awards
// the VOTER for picking correctly (+speed kicker for first correct); bluff
// awards the voter a finder bonus for spotting the truth. House rows never
// earn author-points and quiz rounds skip the unanimous kicker.
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

  // Validate that the voter is actually a player in this room.
  const { data: voter } = await admin
    .from("players").select("session_id").eq("room_code", code).eq("session_id", session_id).single();
  if (!voter) return NextResponse.json({ error: "not a player in this room" }, { status: 403 });

  const { data: sub } = await admin
    .from("submissions")
    .select("*")
    .eq("room_code", code)
    .eq("round", room.current_round)
    .eq("player_session", target_session)
    .single();
  if (!sub) return NextResponse.json({ error: "no submission" }, { status: 404 });

  const qs = parseQuizState(room);
  const quizRound =
    (room.game_type === "quiz-classic" || room.game_type === "quiz-bluff") && qs !== null;
  const quizHouseVote = quizRound && qs !== null && isHouseSession(target_session);

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

  // Atomic vote tally: uses SQL function to prevent lost updates under concurrency.
  await admin.rpc("increment_vote", { p_sub_id: sub.id });

  const { data: players } = await admin.from("players").select("session_id,name").eq("room_code", code);
  const totalPlayers = (players ?? []).length;
  const rr = (room.current_round ?? 0);
  const tr = (room.total_rounds as number | null) ?? 3;
  const isFinal = rr >= tr;

  // Winner of the points: normally the submission's author; quiz house votes
  // pay the voter instead (classic correct pick / bluff truth spot).
  let awardSession: string | null = target_session;
  let awardPts = voteWorth(totalPlayers, isFinal);
  if (quizHouseVote && qs) {
    if (room.game_type === "quiz-classic" && target_session === qs.correct_session) {
      // First-correct-voter wins the speed kicker: resolve by earliest vote row,
      // not by count==1 (two simultaneous correct votes both saw count 1 before).
      const { data: firstCorrect } = await admin
        .from("votes")
        .select("voter_session")
        .eq("room_code", code)
        .eq("round", rr)
        .eq("target_session", qs.correct_session)
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();
      awardSession = session_id;
      awardPts =
        quizCorrectWorth(totalPlayers, isFinal) +
        (firstCorrect?.voter_session === session_id ? quizSpeedBonus(isFinal) : 0);
    } else if (room.game_type === "quiz-bluff" && target_session === QUIZ_TRUTH_SESSION) {
      awardSession = session_id;
      awardPts = quizFinderWorth(isFinal);
    } else {
      // Wrong classic pick: vote counts toward completion, earns nothing.
      awardSession = null;
      awardPts = 0;
    }
  }

  // Read current scores fresh to minimize race window on score accumulation.
  const { data: freshRoom } = await admin.from("rooms").select("scores,round_history").eq("code", code).single();
  const raw = ((freshRoom?.scores ?? {}) as Record<string, number>);
  const scores: Record<string, number> = {};
  const byName = new Map((players ?? []).map((p) => [p.name, p.session_id]));
  for (const [k, v] of Object.entries(raw)) {
    const sid = byName.has(k) ? (byName.get(k) as string) : k;
    scores[sid] = (scores[sid] ?? 0) + (v ?? 0);
  }
  if (awardSession) scores[awardSession] = (scores[awardSession] ?? 0) + awardPts;

  // Per-round delta for phone history + host MVP.
  const rhRaw = ((freshRoom as Record<string, unknown>)?.round_history as Record<string, Record<string, number>> | null) ?? {};
  const roundHist: Record<string, Record<string, number>> = typeof rhRaw === "object" && !Array.isArray(rhRaw) ? { ...rhRaw } : {};
  const key = String(rr);
  roundHist[key] = { ...(roundHist[key] ?? {}) };
  if (awardSession) roundHist[key][awardSession] = (roundHist[key][awardSession] ?? 0) + awardPts;

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
  // At that moment award unanimous bonus to the winner if needed (bluff/text
  // only — quiz rounds have their own speed/finder kickers, and the top row
  // may be a scoreless house row).
  try {
    const { data: rowsRaw } = await admin.from("submissions").select("votes,player_session").eq("room_code", code).eq("round", rr);
    type VoteRow = { votes: number | null; player_session: string };
    const rows: VoteRow[] = (rowsRaw ?? []) as VoteRow[];
    const voted = rows.reduce((n, r) => n + (r.votes ?? 0), 0);
    const enoughVotable = rows.length >= 2;
    if (enoughVotable && voted >= totalPlayers) {
      // unanimous: one answer has all votes
      const maxRow = rows.reduce<VoteRow | null>((m, r) => (!m || (r.votes ?? 0) > (m.votes ?? 0) ? r : m), null);
      if (maxRow && !quizRound && isCleanSweep(maxRow.votes ?? 0, totalPlayers)) {
        // Re-read fresh scores to avoid double-counting the bonus under concurrency.
        const { data: fresh2 } = await admin.from("rooms").select("scores, round_history").eq("code", code).single();
        const curScores = (fresh2?.scores as Record<string, number> | null) ?? scores;
        const curHist = ((fresh2 as Record<string, unknown>)?.round_history as Record<string, Record<string, number>> | null) ?? roundHist;
        // Only award bonus if not already awarded (idempotent check).
        if (!curScores[maxRow.player_session] || curScores[maxRow.player_session] < (scores[maxRow.player_session] ?? 0) + UNANIMOUS_BONUS) {
          curScores[maxRow.player_session] = (curScores[maxRow.player_session] ?? 0) + UNANIMOUS_BONUS;
          const rh2: Record<string, Record<string, number>> = typeof curHist === "object" && !Array.isArray(curHist) ? { ...curHist } : {};
          rh2[key] = { ...(rh2[key] ?? {}) };
          rh2[key][maxRow.player_session] = (rh2[key][maxRow.player_session] ?? 0) + UNANIMOUS_BONUS;
          try {
            await admin.from("rooms").update({ scores: curScores, round_history: rh2, phase: "SCORE", ends_at: null, input_total: null }).eq("code", code).eq("phase", "VOTE");
          } catch {
            await admin.from("rooms").update({ scores: curScores, phase: "SCORE", ends_at: null }).eq("code", code).eq("phase", "VOTE");
          }
        } else {
          await admin.from("rooms").update({ phase: "SCORE", ends_at: null, input_total: null }).eq("code", code).eq("phase", "VOTE");
        }
        await bumpSeq(code);
        await broadcastRoom(code, await getSnapshot(code));
        return NextResponse.json({ ok: true });
      }
      // Conditional write: concurrent last-votes collapse to one SCORE flip.
      await admin.from("rooms").update({ phase: "SCORE", ends_at: null, input_total: null }).eq("code", code).eq("phase", "VOTE");
    }
  } catch { /* best-effort */ }

  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
