import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

/**
 * Anon-key client for public server-side reads. Row-level security is enabled,
 * so this client cannot see unpublished, soft-deleted, or past events.
 */
export function createPublicClient(): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}
