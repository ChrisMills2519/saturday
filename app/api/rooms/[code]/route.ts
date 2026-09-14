import { NextResponse } from "next/server";
import { supabaseAdmin, broadcastRoom } from "@/lib/supabase";
import { getSnapshot } from "@/lib/roomService";

export async function GET(_: Request, { params }: { params: { code: string } }) {
  const room = await getSnapshot(params.code.toUpperCase());
  if (!room) return NextResponse.json({ error: "no room" }, { status: 404 });
  return NextResponse.json(room);
}
