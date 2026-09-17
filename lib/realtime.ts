"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "./supabase";

export type RoomSnapshot = {
  code: string;
  phase: string;
  prompt: string | null;
  prompt_hint: string | null;
  ends_at: string | null;
  current_round: number;
  total_rounds: number;
  game_type: string;
  host_token?: string | null;
  seq: number;
  players: { session_id: string; name: string }[];
  submissions: { player_session: string; text_content: string | null; image_url: string | null; votes: number }[];
  counts: { submitted: number; voted: number; total: number; input_total: number | null };
  scores: Record<string, number>;
  votes_detail: { voter_session: string; target_session: string }[];
  round_history: Record<string, Record<string, number>>;
  used_prompts: string[];
  /** Quiz answer key: correct_session is null until SCORE (server-redacted). */
  quiz: { correct_session: string | null; sessions: string[] } | null;
};

// Single hook both host + phones use. Server is source of truth,
// clients just re-render whatever the API route broadcasts.
export function useRoom(code: string, initial: RoomSnapshot | null) {
  const [room, setRoom] = useState<RoomSnapshot | null>(initial);
  // Monotonic seq guard: drop out-of-order broadcasts. The 3s GET
  // fallback is always trusted and resyncs the baseline.
  const lastSeq = useRef(initial?.seq ?? -1);
  const initialSeq = useRef(initial?.seq ?? -1);

  // First paint: the page fetches the snapshot async after mount, so adopt
  // a late-arriving initial instead of waiting 0-3s for broadcast/poll.
  useEffect(() => {
    if (initial && (initial.seq ?? -1) > lastSeq.current) {
      lastSeq.current = initial.seq;
      initialSeq.current = initial.seq;
      setRoom(initial);
    }
  }, [initial]);

  useEffect(() => {
    if (!code) return;
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`room:${code}`, { config: { broadcast: { self: true } } })
      .on("broadcast", { event: "room_updated" }, ({ payload }) => {
        const next = payload.room as RoomSnapshot;
        if (typeof next?.seq === "number") {
          if (next.seq <= lastSeq.current) return;
          lastSeq.current = next.seq;
        }
        setRoom(next);
      })
      .subscribe();

    // Fallback poll in case broadcast is missed (cheap: every 3s, bones only).
    // Stops after repeated 404s so dead-room screens don't poll forever.
    let misses = 0;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/rooms/${code}`, { cache: "no-store" });
        if (res.status === 404) {
          if (++misses >= 3) clearInterval(poll);
          return;
        }
        if (res.ok) {
          misses = 0;
          const snap = (await res.json()) as RoomSnapshot;
          if (typeof snap?.seq === "number") lastSeq.current = snap.seq;
          setRoom(snap);
        }
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
