import { NextResponse } from "next/server";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";
import { canTransition, revealSeconds } from "@/lib/gameEngine";
import { ANSWER_MAX, sanitizeText, rejectReasonForAnswer } from "@/lib/validation";

export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { session_id, text_content, image_url } = await req.json();
  if (!session_id || (!text_content && !image_url))
    return NextResponse.json({ error: "session_id + text_content or image_url required" }, { status: 400 });
  const cleanText = text_content ? sanitizeText(String(text_content), ANSWER_MAX) : null;
  const reason = rejectReasonForAnswer(cleanText, image_url ? String(image_url) : null);
  if (reason) return NextResponse.json({ error: reason }, { status: 400 });
  // DataURL / URL size guard: big WebViews (Pixel camera, long leaves) get rejected client-side; server too.
  if (image_url && String(image_url).length > 600_000) return NextResponse.json({ error: "drawing too large" }, { status: 400 });
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  if (room.phase !== "INPUT")
    return NextResponse.json({ error: `submit only in INPUT (now ${room.phase})` }, { status: 400 });

  // Validate that the submitter is actually a player in this room.
  const { data: player } = await admin
    .from("players").select("session_id").eq("room_code", code).eq("session_id", session_id).single();
  if (!player) return NextResponse.json({ error: "not a player in this room" }, { status: 403 });

  const { error } = await admin.from("submissions").upsert(
    { room_code: code, round: room.current_round, player_session: session_id, text_content: cleanText ?? null, image_url: image_url ? String(image_url) : null },
    { onConflict: "room_code,round,player_session" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Instant advance: when everyone has submitted, stop the clock and flip
  // to REVEAL server-authoritatively (host timer stays as fallback for
  // partial submits). Conditional WHERE prevents clobbering a concurrent
  // timer-initiated phase change.
  const snap = await getSnapshot(code);
  const submitted = snap?.counts?.submitted ?? 0;
  const total = snap?.counts?.total ?? 0;
  if (snap?.phase === "INPUT" && total >= 2 && submitted >= total && canTransition("INPUT", "REVEAL")) {
    await admin.from("rooms").update({ phase: "REVEAL", ends_at: new Date(Date.now() + revealSeconds(submitted) * 1000).toISOString(), input_total: null }).eq("code", code).eq("phase", "INPUT");
  }
  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
