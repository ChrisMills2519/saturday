import { NextResponse } from "next/server";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot } from "@/lib/roomService";

// Must stay dynamic: supabase-js uses fetch internally and App Router
// caches fetch by default, so without this GET would keep returning the
// first-ever snapshot for a room (stale LOBBY) and the 3s useRoom()
// fallback poll would snap every screen back to it.
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { code: string } }) {
  const room = await getSnapshot(params.code.toUpperCase());
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  return NextResponse.json(room);
}
