import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/session";

/**
 * Where the email-confirmation link lands.
 *
 * Supabase sends a one-time `code` which is exchanged here for a session, so the
 * user arrives already signed in rather than being asked to log in immediately
 * after proving they own the address.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin, pathname } = new URL(request.url);
  const code = searchParams.get("code");
  const locale = pathname.split("/")[1] === "en" ? "en" : "ka";

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/auth/login?error=missing_code`);
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/${locale}/auth/login?error=expired`);
  }

  return NextResponse.redirect(`${origin}/${locale}/profile`);
}
