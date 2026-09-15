import { NextResponse } from "next/server";
import { canTransition, INPUT_SECONDS, type Phase } from "@/lib/gameEngine";
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
  // LOBBY is the only phase start can run in, so the token is advisory here
  // (a replacement TV must be able to kick the game off). Enforced after start.
  if (
    headerToken &&
    (room as Record<string, unknown>).host_token &&
    headerToken !== (room as Record<string, unknown>).host_token
  )
    return NextResponse.json({ error: "host token mismatch" }, { status: 403 });
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
    // Host may set length while still in LOBBY; clamped 1-9.
    ...(typeof total_rounds === "number" && Number.isFinite(total_rounds)
      ? { total_rounds: Math.min(9, Math.max(1, Math.floor(total_rounds))) }
      : {}),
  };
  let { error } = await admin.from("rooms").update(patch).eq("code", code);
  // Fallback when new columns haven't been migrated live yet.
  if (error?.message?.match?.(/prompt_hint|used_prompts|input_total|game_type/i)) {
    const { error: e2 } = await admin
      .from("rooms")
      .update({
        phase: "INPUT",
        prompt: nextPrompt,
        ends_at: endsAt,
        current_round: (room.current_round ?? 0) + 1,
        ...(typeof total_rounds === "number" && Number.isFinite(total_rounds)
          ? { total_rounds: Math.min(9, Math.max(1, Math.floor(total_rounds))) }
          : {}),
      })
      .eq("code", code);
    error = e2;
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
