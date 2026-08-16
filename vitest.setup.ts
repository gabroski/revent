import { config } from "dotenv";

// Tests that touch Supabase read the same local config as the dev server.
config({ path: ".env.local", quiet: true });

// Pure-logic and component tests must not require a database. When no local
// Supabase is configured, supply placeholder config so modules that build URLs
// still work, and mark the database as unavailable so the integration suites
// (RLS, queries, search) skip rather than fail against a server that isn't there.
const configured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

process.env.REVENT_DB_AVAILABLE = configured ? "true" : "false";

if (!configured) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder-anon-key";
}
