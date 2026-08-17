import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import type { Locale } from "@/i18n/routing";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "venue_owner" | "admin";
  locale: Locale;
};

/**
 * Cookie-backed client for server components and server actions.
 *
 * Sessions live in cookies rather than localStorage so server components can
 * read them. With localStorage every page would render logged-out and then
 * flicker once the browser rehydrated.
 */
export async function createServerSupabase() {
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components cannot set cookies. The proxy refreshes the
          // session on every request, so nothing is lost here.
        }
      },
    },
  });
}

/**
 * The signed-in user with their profile, or null.
 *
 * Uses getUser() rather than getSession(): getSession reads the cookie without
 * verifying it, so a forged cookie would pass. getUser validates against the
 * auth server.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, locale")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "",
    role: (profile?.role as SessionUser["role"]) ?? "user",
    locale: (profile?.locale as Locale) ?? "ka",
  };
}
