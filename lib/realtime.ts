"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "./supabase";

export type RoomSnapshot = {
  code: string;
  phase: string;
  prompt: string | null;
  ends_at: string | null;
  current_round: number;
  players: { session_id: string; name: string }[];
  submissions: { player_session: string; text_content: string | null; image_url: string | null; votes: number }[];
  scores: Record<string, number>;
};

// Single hook both host + phones use. Server is source of truth,
// clients just re-render whatever the API route broadcasts.
export function useRoom(code: string, initial: RoomSnapshot | null) {
  const [room, setRoom] = useState<RoomSnapshot | null>(initial);

  useEffect(() => {
    if (!code) return;
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`room:${code}`, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "room_updated" }, ({ payload }) => {
        setRoom(payload.room);
      })
      .subscribe();

    // Fallback poll in case broadcast is missed (cheap: every 3s, bones only).
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
        if (res.ok) setRoom(await res.json());
      } catch {}
    }, 3000);

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [code]);

  return room;
}

// Client-side countdown from server timestamp. No per-second server ticks
// (that pattern blows Supabase Realtime quotas).
export function useCountdown(endsAt: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) {
      setLeft(null);
      return;
    }
    const tick = () => {
      setLeft(Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);
  return left;
}
