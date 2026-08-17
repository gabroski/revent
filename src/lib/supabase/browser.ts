"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

/** For client components that need to react to auth state (sign out, listeners). */
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
