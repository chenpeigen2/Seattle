import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { serveSite } from "./adapter.mjs";
import { createHandler } from "./handler.ts";
import { SupabaseStore } from "./supabase-store.ts";

Deno.serve(serveSite(async ({ request, supabase }: { request: Request; supabase: unknown }) => {
  const handler = createHandler(new SupabaseStore(supabase));
  return await handler.handle(request);
}, {
  createClient,
  env: (name: string) => Deno.env.get(name),
}));
