import { NextResponse } from "next/server";
import { canTransition, INPUT_SECONDS, makeHostToken, type Phase } from "@/lib/gameEngine";
import { nextTextPrompt, nextDrawPrompt, hintForPrompt } from "@/lib/prompts";
import { drawHintFor } from "@/lib/prompts_draw";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";

// Host starts a round. Timer = single ends_at timestamp, phones count down locally.
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

  if (!canTransition(room.phase as Phase, "INPUT"))
    return NextResponse.json({ error: `bad transition ${room.phase} -> INPUT` }, { status: 400 });
  // Voting needs someone else to vote for: solo starts would dead-end at VOTE.
  const { count: playerCount } = await admin
    .from("players")
    .select("id", { count: "exact", head: true })
    .eq("room_code", code);
  if ((playerCount ?? 0) < 2)
    return NextResponse.json({ error: "need 2+ players to start" }, { status: 400 });
  const endsAt = new Date(Date.now() + INPUT_SECONDS * 1000).toISOString();
  const gt = game_type === "draw" ? "draw" : game_type === "text" ? "text" : (room.game_type as string) ?? "text";
  const chosen =
    typeof prompt === "string" && prompt.trim().length > 1
      ? { text: (prompt as string).trim(), hint: gt === "draw" ? drawHintFor((prompt as string).trim()) : hintForPrompt((prompt as string).trim()) }
      : gt === "draw"
        ? (() => {
            const t = nextDrawPrompt(room.prompt as string | null);
            return { text: t, hint: drawHintFor(t) };
          })()
        : (() => {
            const card = nextTextPrompt({ exclude: room.prompt as string | null, used: (room as Record<string, unknown>).used_prompts as string[] | undefined });
            return { text: card, hint: hintForPrompt(card) };
          })();
  const hintVal = chosen.hint;
  const nextPrompt = chosen.text;
  const used = Array.isArray((room as Record<string, unknown>).used_prompts)
    ? ((room as Record<string, unknown>).used_prompts as string[])
    : [];
  const nextUsed = [...used, nextPrompt].slice(-120);
  const patch: Record<string, unknown> = {
    phase: "INPUT",
    game_type: gt,
    prompt: nextPrompt,
    prompt_hint: hintVal,
    ends_at: endsAt,
    current_round: (room.current_round ?? 0) + 1,
    input_total: playerCount ?? 0,
    used_prompts: nextUsed,
    ...(typeof total_rounds === "number" && Number.isFinite(total_rounds)
      ? { total_rounds: Math.min(9, Math.max(1, Math.floor(total_rounds))) }
      : {}),
    ...(newHostToken ? { host_token: newHostToken } : {}),
  };
  let { error } = await admin.from("rooms").update(patch).eq("code", code);
  // Fallback when new columns haven't been migrated live yet.
  if (error?.message?.match?.(/prompt_hint|used_prompts|input_total|game_type/i)) {
    const fallback: Record<string, unknown> = {
      phase: "INPUT",
      prompt: nextPrompt,
      ends_at: endsAt,
      current_round: (room.current_round ?? 0) + 1,
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
