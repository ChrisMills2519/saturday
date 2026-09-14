import { createClient } from "@supabase/supabase-js";

// Browser client (anon key). Subscribe only, never broadcast directly.
export function supabaseBrowser() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Server client (service_role). Only API routes use this to write + broadcast.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
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
