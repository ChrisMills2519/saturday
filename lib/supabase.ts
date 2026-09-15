import { createClient } from "@supabase/supabase-js";

// Browser client (anon key). Subscribe only, never broadcast directly.
export function supabaseBrowser() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Server client (service_role). Only API routes use this to write + broadcast.
// Wraps fetch with cache:"no-store": supabase-js uses global fetch, which App
// Router caches by default — without this, GET snapshots freeze at the first
// read per room (stale LOBBY) and the 3s useRoom() fallback poll snaps every
// screen back to it.
function noStoreFetch(url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) {
  return fetch(url, { ...init, cache: "no-store" });
}

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, global: { fetch: noStoreFetch } }
  );
}

export async function broadcastRoom(code: string, room: unknown) {
  const admin = supabaseAdmin();
  const channel = admin.channel(`room:${code}`);
  await channel.subscribe();
  await channel.send({
    type: "broadcast",
    event: "room_updated",
    payload: { room },
  });
  await admin.removeChannel(channel);
}
