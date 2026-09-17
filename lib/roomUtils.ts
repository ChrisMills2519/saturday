import type { RoomSnapshot } from "@/lib/realtime";

export function nameOf(room: RoomSnapshot, sessionId: string): string {
  return room.players.find((p) => p.session_id === sessionId)?.name ?? "...";
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + ((s[(v - 20) % 10] || s[v] || s[0]) as string);
}
