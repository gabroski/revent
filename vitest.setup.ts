import { config } from "dotenv";

// Tests that touch Supabase read the same local config as the dev server.
config({ path: ".env.local", quiet: true });
