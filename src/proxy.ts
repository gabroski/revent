import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { getEnv } from "@/lib/env";

const handleI18n = createMiddleware(routing);

/**
 * Runs on every request: refresh the auth session, then handle locale routing.
 *
 * Order matters. Supabase access tokens are short-lived, and only a request
 * handler can write the refreshed cookie back. Without this, a user is silently
 * signed out roughly every hour.
 */
export default async function proxy(request: NextRequest) {
  const response = handleI18n(request);
  const { supabaseUrl, supabaseAnonKey } = getEnv();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Touching getUser() is what triggers the refresh; the result is unused here.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/", "/(ka|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
