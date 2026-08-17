import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().optional(),
});

export type Env = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /**
   * The canonical origin of this deployment.
   *
   * Never derived from request headers. Password-reset and email-confirmation
   * links are built from this, and a Host header is attacker-controlled: a
   * spoofed one would send a working reset token to someone else's domain.
   */
  siteUrl: string;
};

const DEV_SITE_URL = "http://localhost:3000";

export function getEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }

  const siteUrl = parsed.data.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl && process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL must be set in production: auth emails link to it.",
    );
  }

  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    siteUrl: (siteUrl ?? DEV_SITE_URL).replace(/\/$/, ""),
  };
}
