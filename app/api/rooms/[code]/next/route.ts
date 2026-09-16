import { NextResponse } from "next/server";
import { canTransition, INPUT_SECONDS, VOTE_SECONDS, type Phase } from "@/lib/gameEngine";
import { nextTextPrompt, nextDrawPrompt, hintForPrompt } from "@/lib/prompts";
import { drawHintFor } from "@/lib/prompts_draw";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { to, prompt, game_type } = await req.json().catch(() => ({} as Record<string, unknown>));
  const headerToken = req.headers.get("x-host-token");
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  // Host guard: enforced once the game has left LOBBY. LOBBY stays open so a
  // replacement TV can start the game if the original host device dies.
  if (
    room.phase !== "LOBBY" &&
    (room as Record<string, unknown>).host_token &&
    headerToken !== (room as Record<string, unknown>).host_token
  )
    return NextResponse.json({ error: "host token required" }, { status: 403 });
  if (!canTransition(room.phase as Phase, to as Phase))
    return NextResponse.json({ error: `bad transition ${room.phase} -> ${to}` }, { status: 400 });
  const patch: Record<string, unknown> = { phase: to as string };
  if (to === "INPUT") {
    patch.current_round = (room.current_round ?? 0) + 1;    // Bonus round off the final SCORE ("One more round"): extend the game's
    // length so the header reads "Round N of N" instead of "Round 4 of 3".
    const tr = (room.total_rounds as number | null) ?? 3;
    const cur = patch.current_round as number;
    if (cur > tr) patch.total_rounds = cur;
    const gt = (game_type as string) === "draw" ? "draw" : (game_type as string) === "text" ? "text" : (room.game_type as string) ?? "text";
    if (gt === "quiz-classic" || gt === "quiz-bluff")
      return NextResponse.json({ error: "quiz rounds start via start (LOBBY/SCORE -> REVEAL/INPUT)" }, { status: 400 });
    patch.game_type = gt;
    // Leaving quiz: drop any stale quiz_state so old correct answers can't leak.
    patch.quiz_state = null;
    if (typeof prompt === "string" && prompt.trim().length > 1) {
      patch.prompt = (prompt as string).trim();
      patch.prompt_hint = gt === "draw" ? drawHintFor((prompt as string).trim()) : hintForPrompt((prompt as string).trim());
    } else if (gt === "draw") {
      const t = nextDrawPrompt(room.prompt as string | null);
      patch.prompt = t;
      patch.prompt_hint = drawHintFor(t);
    } else {
      const t = nextTextPrompt({ exclude: room.prompt as string | null, used: (room as Record<string, unknown>).used_prompts as string[] | undefined });
      patch.prompt = t;
      patch.prompt_hint = hintForPrompt(t);
    }
    patch.ends_at = new Date(Date.now() + INPUT_SECONDS * 1000).toISOString();
    // freeze denom for this round
    const { count } = await admin.from("players").select("id", { count: "exact", head: true }).eq("room_code", code);
    patch.input_total = count ?? 0;
    const used = Array.isArray((room as Record<string, unknown>).used_prompts)
      ? ((room as Record<string, unknown>).used_prompts as string[])
      : [];
    patch.used_prompts = [...used, patch.prompt as string].slice(-120);
  } else if (to === "VOTE") {
    patch.ends_at = new Date(Date.now() + VOTE_SECONDS * 1000).toISOString();
  } else {
    patch.ends_at = null;
    patch.input_total = null;
  }
  if (to === "LOBBY") {
    patch.ends_at = null;
    patch.scores = {};
    patch.round_history = {};
    patch.input_total = null;
    patch.current_round = 0;
    patch.prompt = null;
    patch.prompt_hint = null;
    patch.quiz_state = null;
    // keep game_type + used_prompts + host_token so the room stays replay-ready
  }
  let { error } = await admin.from("rooms").update(patch).eq("code", code);
  // fallback for pre-migration DB
  if (error?.message?.match?.(/prompt_hint|used_prompts|input_total|game_type|round_history|quiz_state/i)) {
    const fallback: Record<string, unknown> = { phase: to as string };
    if (to === "INPUT") {
      fallback.current_round = patch.current_round;
      fallback.prompt = patch.prompt;
      fallback.ends_at = patch.ends_at;
    } else if (to === "VOTE") fallback.ends_at = patch.ends_at;
    else if (to === "SCORE") {
      fallback.ends_at = null;
      fallback.input_total = null;
    } else if (to === "LOBBY") {
      fallback.ends_at = null;
      fallback.scores = {};
      fallback.current_round = 0;
      fallback.prompt = null;
    }
    // strip if still errors, try minimal
    const r2 = await admin.from("rooms").update(fallback).eq("code", code);
    error = r2.error;
    if (error?.message?.match?.(/input_total/i)) {
      const noInput = { ...fallback } as Record<string, unknown>;
      delete noInput.input_total;
      const r3 = await admin.from("rooms").update(noInput).eq("code", code);
      error = r3.error;
    }
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
