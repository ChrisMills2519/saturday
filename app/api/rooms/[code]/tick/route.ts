import { NextResponse } from "next/server";
import { expireRoomByCode } from "@/lib/phaseAdvance";

// POST /api/rooms/:code/tick — idempotent expiry advance for any client.
// Phones fire this when their local countdown hits 0 so a sleeping TV tab
// can't park the game. No auth (like GET): the engine gate + conditional
// phase write make stray/duplicate calls safe no-ops.
export const dynamic = "force-dynamic";

export async function POST(_: Request, { params }: { params: { code: string } }) {
  const advanced = await expireRoomByCode(params.code.toUpperCase());
  return NextResponse.json({ ok: true, advanced });
}
