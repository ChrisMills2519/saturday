import { NextResponse } from "next/server";
import {
  canTransition,
  INPUT_SECONDS,
  QUIZ_READ_SECONDS,
  makeHostToken,
  type GameType,
  type Phase,
} from "@/lib/gameEngine";
import { nextTextPrompt, nextDrawPrompt, hintForPrompt } from "@/lib/prompts";
import { drawHintFor } from "@/lib/prompts_draw";
import { randomQuizCard, QUIZ_CARDS } from "@/lib/prompts_quiz";
import {
  buildClassicState,
  QUIZ_HOUSE_SESSIONS,
  QUIZ_TRUTH_SESSION,
  type QuizState,
} from "@/lib/quiz";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";

function normalizeGameType(v: unknown, fallback: unknown): GameType {
  if (v === "draw" || v === "text" || v === "quiz-classic" || v === "quiz-bluff") return v;
  if (fallback === "draw" || fallback === "text" || fallback === "quiz-classic" || fallback === "quiz-bluff")
    return fallback;
  return "text";
}

function quizCategoryLabel(category: string): string {
  const c = (category || "trivia").trim() || "trivia";
  return `Trivia: ${c.charAt(0).toUpperCase()}${c.slice(1)}`;
}

// Host starts a round. Timer = single ends_at timestamp, phones count down locally.
// Quiz-classic skips INPUT (nothing to write): LOBBY/SCORE -> REVEAL with the
// question + 4 house choices pre-inserted. Quiz-bluff rides the normal
// INPUT flow with the truth pre-inserted as a hidden house row.
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { prompt, total_rounds, game_type } = await req.json().catch(() => ({} as Record<string, unknown>));
  const headerToken = req.headers.get("x-host-token");
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });

  // Host token enforcement + takeover:
  // - Original host (token matches): keep stored token, proceed.
  // - Replacement TV (no token): mint new token, they become host.
  // - Wrong token: 403.
  const storedToken = (room as Record<string, unknown>).host_token as string | null;
  let newHostToken: string | null = null;
  if (storedToken) {
    if (headerToken && headerToken !== storedToken)
      return NextResponse.json({ error: "host token mismatch" }, { status: 403 });
    if (!headerToken) {
      // Takeover: mint new token so the replacement TV can drive the game.
      newHostToken = makeHostToken();
    }
  }

  const gt = normalizeGameType(game_type, room.game_type);
  const targetPhase: Phase = gt === "quiz-classic" ? "REVEAL" : "INPUT";
  // Classic opens mid-machine (LOBBY/SCORE -> REVEAL); the base INPUT->REVEAL
  // row must not let a classic start hijack a live INPUT round.
  if (gt === "quiz-classic" && room.phase !== "LOBBY" && room.phase !== "SCORE")
    return NextResponse.json({ error: `bad transition ${room.phase} -> ${targetPhase}` }, { status: 400 });
  if (!canTransition(room.phase as Phase, targetPhase, gt))
    return NextResponse.json({ error: `bad transition ${room.phase} -> ${targetPhase}` }, { status: 400 });
  // Voting needs someone else to vote for: solo starts would dead-end at VOTE.
  const { count: playerCount } = await admin
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("room_code", code);
  if ((playerCount ?? 0) < 2)
    return NextResponse.json({ error: "need 2+ players to start" }, { status: 400 });

  const used = Array.isArray((room as Record<string, unknown>).used_prompts)
    ? ((room as Record<string, unknown>).used_prompts as string[])
    : [];
  const nextRound = (room.current_round ?? 0) + 1;
  const patch: Record<string, unknown> = {
    phase: targetPhase,
    game_type: gt,
    current_round: nextRound,
    ...(newHostToken ? { host_token: newHostToken } : {}),
    ...(typeof total_rounds === "number" && Number.isFinite(total_rounds)
      ? { total_rounds: Math.min(9, Math.max(1, Math.floor(total_rounds))) }
      : {}),
  };
  let nextUsed = used;

  if (gt === "quiz-classic") {
    if (QUIZ_CARDS.length === 0) return NextResponse.json({ error: "no quiz cards" }, { status: 500 });
    const card = randomQuizCard(null, used);
    const state: QuizState = buildClassicState(card);
    // Pre-insert the 4 choices as house rows so VOTE tallies work untouched.
    const rows = state.choices.map((text, i) => ({
      room_code: code,
      round: nextRound,
      player_session: QUIZ_HOUSE_SESSIONS[i],
      text_content: text,
    }));
    const { error: houseErr } = await admin.from("submissions").upsert(rows, {
      onConflict: "room_code,round,player_session",
    });
    if (houseErr) return NextResponse.json({ error: houseErr.message }, { status: 500 });
    patch.prompt = card.question;
    patch.prompt_hint = quizCategoryLabel(card.category);
    patch.quiz_state = state;
    patch.ends_at = new Date(Date.now() + QUIZ_READ_SECONDS * 1000).toISOString();
    patch.input_total = null;
    nextUsed = [...used, card.id].slice(-120);
  } else if (gt === "quiz-bluff") {
    if (QUIZ_CARDS.length === 0) return NextResponse.json({ error: "no quiz cards" }, { status: 500 });
    const card = randomQuizCard(null, used);
    // Truth hides among player fakes: blind INPUT redaction covers house rows too.
    const { error: houseErr } = await admin.from("submissions").upsert(
      {
        room_code: code,
        round: nextRound,
        player_session: QUIZ_TRUTH_SESSION,
        text_content: card.answer,
      },
      { onConflict: "room_code,round,player_session" },
    );
    if (houseErr) return NextResponse.json({ error: houseErr.message }, { status: 500 });
    patch.prompt = card.question;
    patch.prompt_hint = quizCategoryLabel(card.category);
    patch.quiz_state = {
      quiz_id: card.id,
      choices: [],
      correct_index: -1,
      correct_session: QUIZ_TRUTH_SESSION,
    } satisfies QuizState;
    patch.ends_at = new Date(Date.now() + INPUT_SECONDS * 1000).toISOString();
    patch.input_total = playerCount ?? 0;
    nextUsed = [...used, card.id].slice(-120);
  } else {
    const endsAt = new Date(Date.now() + INPUT_SECONDS * 1000).toISOString();
    const chosen =
      typeof prompt === "string" && prompt.trim().length > 1
        ? { text: (prompt as string).trim(), hint: gt === "draw" ? drawHintFor((prompt as string).trim()) : hintForPrompt((prompt as string).trim()) }
        : gt === "draw"
          ? (() => {
              const t = nextDrawPrompt(room.prompt as string | null);
              return { text: t, hint: drawHintFor(t) };
            })()
          : (() => {
              const card = nextTextPrompt({ exclude: room.prompt as string | null, used });
              return { text: card, hint: hintForPrompt(card) };
            })();
    patch.prompt = chosen.text;
    patch.prompt_hint = chosen.hint;
    patch.quiz_state = null;
    patch.ends_at = endsAt;
    patch.input_total = playerCount ?? 0;
    nextUsed = [...used, chosen.text].slice(-120);
  }
  patch.used_prompts = nextUsed;

  let { error } = await admin.from("rooms").update(patch).eq("code", code);
  // Fallback when new columns haven't been migrated live yet.
  if (error?.message?.match?.(/prompt_hint|used_prompts|input_total|game_type|quiz_state/i)) {
    if (gt === "quiz-classic" || gt === "quiz-bluff")
      return NextResponse.json({ error: "quiz needs the quiz_state migration (supabase/schema.sql)" }, { status: 500 });
    const fallback: Record<string, unknown> = {
      phase: "INPUT",
      prompt: patch.prompt,
      ends_at: patch.ends_at,
      current_round: nextRound,
      ...(newHostToken ? { host_token: newHostToken } : {}),
      ...(typeof total_rounds === "number" && Number.isFinite(total_rounds)
        ? { total_rounds: Math.min(9, Math.max(1, Math.floor(total_rounds))) }
        : {}),
    };
    const { error: e2 } = await admin.from("rooms").update(fallback).eq("code", code);
    error = e2;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true, ...(newHostToken ? { host_token: newHostToken } : {}) });
}
