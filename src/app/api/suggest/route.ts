import { NextResponse, type NextRequest } from "next/server";
import { routing, type Locale } from "@/i18n/routing";
import { EMPTY_SUGGESTIONS, getSuggestions } from "@/modules/discovery/suggest";

/**
 * Typeahead suggestions. Read-only and public, matching what the discovery
 * pages already show, so there is nothing here an anonymous visitor could not
 * already see by browsing.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const requested = searchParams.get("locale") ?? routing.defaultLocale;
  const locale = (routing.locales as readonly string[]).includes(requested)
    ? (requested as Locale)
    : routing.defaultLocale;

  try {
    const groups = await getSuggestions(query, locale);
    return NextResponse.json(groups, {
      headers: { "Cache-Control": "private, max-age=15" },
    });
  } catch {
    // A failing typeahead must never break typing: return nothing quietly.
    return NextResponse.json(EMPTY_SUGGESTIONS);
  }
}
