import { NextResponse } from "next/server";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot, bumpSeq } from "@/lib/roomService";

// POST /api/rooms/:code/kick — host removes a player.
// Body: { target_session }. Deletes the player row + their round votes and
// current/future submissions so they can't be voted for after leaving.
// Host-token guarded when the room has a token.
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { target_session } = await req.json().catch(() => ({} as Record<string, unknown>));
  if (!target_session) return NextResponse.json({ error: "target_session required" }, { status: 400 });
  // Guard the PostgREST .or() filter below: raw interpolation of `,`/`(`/`)`
  // could break the filter or widen the delete. UUIDs + quiz:* only.
  if (typeof target_session !== "string" || !/^[A-Za-z0-9-:]{1,64}$/.test(target_session))
    return NextResponse.json({ error: "bad target_session" }, { status: 400 });
  const headerToken = req.headers.get("x-host-token");
  const admin = supabaseAdmin();
  const { data: room } = await admin.from("rooms").select("*").eq("code", code).single();
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  // Kick is destructive: token required whenever the room has one (LOBBY included).
  if ((room as Record<string, unknown>).host_token && headerToken !== (room as Record<string, unknown>).host_token)
    return NextResponse.json({ error: "host token required" }, { status: 403 });
  const { data: target } = await admin
    .from("players")
    .select("session_id")
    .eq("room_code", code)
    .eq("session_id", target_session)
    .single();
  if (!target) return NextResponse.json({ error: "no such player" }, { status: 404 });

  await admin.from("players").delete().eq("room_code", code).eq("session_id", target_session);
  // Remove only current/future round rows so past SCORE displays + history stay intact.
  const curRound = (room.current_round as number | null) ?? 0;
  await admin.from("submissions").delete().eq("room_code", code).eq("player_session", target_session).gte("round", curRound);
  await admin.from("votes").delete().eq("room_code", code).eq("round", curRound).or(`voter_session.eq.${target_session},target_session.eq.${target_session}`);

  const { count: remaining } = await admin.from("players").select("id", { count: "exact", head: true }).eq("room_code", code);
  if ((remaining ?? 0) < 2 && room.phase === "INPUT") {
    // Abort the round: too few humans to score.
    await admin.from("rooms").update({ phase: "LOBBY", ends_at: null, input_total: null }).eq("code", code);
  } else if (room.phase === "INPUT" || room.phase === "VOTE") {
    // Re-freeze the denominator so remaining players aren't stuck at N-1/N.
    await admin.from("rooms").update({ input_total: remaining ?? 0 }).eq("code", code);
  }
  await bumpSeq(code);
  await broadcastRoom(code, await getSnapshot(code));
  return NextResponse.json({ ok: true });
}
