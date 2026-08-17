import { createPublicClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import { sanitizeQuery } from "./filters";

export type SuggestionKind = "event" | "venue" | "category";

export type Suggestion = {
  kind: SuggestionKind;
  label: string;
  /** Secondary line: venue and city for an event, city for a venue. */
  detail: string;
  href: string;
};

export type SuggestionGroups = {
  events: Suggestion[];
  venues: Suggestion[];
  categories: Suggestion[];
};

export const EMPTY_SUGGESTIONS: SuggestionGroups = {
  events: [],
  venues: [],
  categories: [],
};

/** Below this a query matches nearly everything, which is noise rather than help. */
export const MIN_QUERY_LENGTH = 2;

export function totalSuggestions(groups: SuggestionGroups): number {
  return groups.events.length + groups.venues.length + groups.categories.length;
}

/** Flattened in display order, so keyboard navigation and rendering agree. */
export function flattenSuggestions(groups: SuggestionGroups): Suggestion[] {
  return [...groups.events, ...groups.venues, ...groups.categories];
}

/**
 * What to offer while someone is typing.
 *
 * Three kinds, because they are three different questions: an event name is a
 * destination, a venue is a place to browse, a category is a filter. Collapsing
 * them into one ranked list would hide that distinction.
 */
export async function getSuggestions(
  rawQuery: string,
  locale: Locale,
): Promise<SuggestionGroups> {
  const query = sanitizeQuery(rawQuery);
  if (query.length < MIN_QUERY_LENGTH) return EMPTY_SUGGESTIONS;

  const supabase = createPublicClient();
  const pattern = `%${query.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const now = new Date().toISOString();

  const [eventRows, venueRows, categoryRows] = await Promise.all([
    supabase
      .from("events")
      .select(
        `slug, title_ka, title_en,
         venue:venues!inner (name_ka, name_en),
         city:cities!inner (name_ka, name_en)`,
      )
      .eq("is_published", true)
      .is("deleted_at", null)
      .gte("starts_at", now)
      .ilike("search_text", pattern)
      .order("starts_at", { ascending: true })
      .limit(5),

    supabase
      .from("venues")
      .select("slug, name_ka, name_en, city:cities!inner (name_ka, name_en)")
      .is("deleted_at", null)
      .or(`name_ka.ilike.${pattern},name_en.ilike.${pattern}`)
      .limit(3),

    supabase
      .from("categories")
      .select("slug, name_ka, name_en")
      .or(`name_ka.ilike.${pattern},name_en.ilike.${pattern}`)
      .order("sort_order")
      .limit(3),
  ]);

  type Row = Record<string, unknown>;

  return {
    events: (eventRows.data ?? []).map((row) => {
      const r = row as Row;
      const venue = pickContent(r.venue as Row, "name", locale) ?? "";
      const city = pickContent(r.city as Row, "name", locale) ?? "";
      return {
        kind: "event" as const,
        label: pickContent(r, "title", locale) ?? "",
        detail: [venue, city].filter(Boolean).join(" · "),
        href: `/${locale}/events/${r.slug as string}`,
      };
    }),

    venues: (venueRows.data ?? []).map((row) => {
      const r = row as Row;
      return {
        kind: "venue" as const,
        label: pickContent(r, "name", locale) ?? "",
        detail: pickContent(r.city as Row, "name", locale) ?? "",
        href: `/${locale}/venues/${r.slug as string}`,
      };
    }),

    categories: (categoryRows.data ?? []).map((row) => {
      const r = row as Row;
      return {
        kind: "category" as const,
        label: pickContent(r, "name", locale) ?? "",
        detail: "",
        href: `/${locale}/tbilisi?category=${r.slug as string}`,
      };
    }),
  };
}
