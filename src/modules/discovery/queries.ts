import { createPublicClient } from "@/lib/supabase/server";
import { resolveDateRange, sanitizeQuery, type EventFilters } from "./filters";
import type {
  Category,
  City,
  EventDetail,
  EventListItem,
  VenueDetail,
} from "./types";

/**
 * The only module allowed to query events for public pages.
 *
 * Every query here repeats the public-visibility filters (published, not deleted,
 * not past) even though RLS enforces them too. Neither layer is trusted alone.
 */

const LIST_SELECT = `
  id, slug, title_ka, title_en, starts_at, poster_image_path,
  entry_fee_gel, favorite_count,
  venue:venues!inner (id, slug, name_ka, name_en, is_verified),
  city:cities!inner (id, slug, name_ka, name_en),
  category:categories!inner (id, slug, name_ka, name_en, icon, sort_order)
`;

/** Cursor encodes the sort key, so pagination stays stable when rows are inserted mid-scroll. */
function encodeCursor(item: EventListItem): string {
  return Buffer.from(`${item.starts_at}|${item.id}`).toString("base64url");
}

function decodeCursor(cursor: string): { startsAt: string; id: string } | null {
  try {
    const [startsAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    return startsAt && id ? { startsAt, id } : null;
  } catch {
    return null;
  }
}

export async function listEvents(
  filters: EventFilters,
  limit = 24,
): Promise<{ items: EventListItem[]; nextCursor: string | null }> {
  const supabase = createPublicClient();
  const range = resolveDateRange(filters.when, new Date());

  let query = supabase
    .from("events")
    .select(LIST_SELECT)
    .eq("is_published", true)
    .is("deleted_at", null)
    .gte("starts_at", range.from.toISOString())
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit + 1);

  if (range.to) query = query.lt("starts_at", range.to.toISOString());
  if (filters.citySlug) query = query.eq("cities.slug", filters.citySlug);
  if (filters.categorySlug) query = query.eq("categories.slug", filters.categorySlug);
  if (filters.freeOnly) query = query.is("entry_fee_gel", null);

  if (filters.q) {
    // Sanitize before escaping: the WAF rejects punctuation before Postgres sees it.
    const cleaned = sanitizeQuery(filters.q);
    if (cleaned) {
      // ilike over the generated search_text column; the trigram index serves this.
      const escaped = cleaned.replace(/[%_\\]/g, (m) => `\\${m}`);
      query = query.ilike("search_text", `%${escaped}%`);
    }
  }

  const decoded = filters.cursor ? decodeCursor(filters.cursor) : null;
  if (decoded) {
    query = query.or(
      `starts_at.gt.${decoded.startsAt},and(starts_at.eq.${decoded.startsAt},id.gt.${decoded.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`listEvents failed: ${error.message}`);

  const rows = (data ?? []) as unknown as EventListItem[];
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? encodeCursor(items[items.length - 1]) : null;
  return { items, nextCursor };
}

export async function getEventBySlug(slug: string): Promise<EventDetail | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("events")
    // Spelled out rather than interpolating LIST_SELECT: the detail page needs more
    // venue columns, and joining `venue` twice makes PostgREST reject the whole query.
    .select(
      `
      id, slug, title_ka, title_en, starts_at, poster_image_path,
      entry_fee_gel, favorite_count,
      description_ka, description_en, ends_at, dress_code, view_count,
      city:cities!inner (id, slug, name_ka, name_en),
      category:categories!inner (id, slug, name_ka, name_en, icon, sort_order),
      venue:venues!inner (
        id, slug, name_ka, name_en, is_verified,
        description_ka, description_en, address_ka, address_en,
        phone, website, instagram, facebook
      ),
      images:event_images (id, image_path, position)
    `,
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .gte("starts_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(`getEventBySlug failed: ${error.message}`);
  return (data as unknown as EventDetail) ?? null;
}

export async function getVenueBySlug(slug: string): Promise<VenueDetail | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("venues")
    .select(
      `
      id, slug, name_ka, name_en, description_ka, description_en,
      address_ka, address_en, phone, website, instagram, facebook,
      cover_image_path, is_verified,
      city:cities!inner (id, slug, name_ka, name_en)
    `,
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`getVenueBySlug failed: ${error.message}`);
  return (data as unknown as VenueDetail) ?? null;
}

export async function listVenueEvents(venueId: string): Promise<EventListItem[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("events")
    .select(LIST_SELECT)
    .eq("venue_id", venueId)
    .eq("is_published", true)
    .is("deleted_at", null)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(48);

  if (error) throw new Error(`listVenueEvents failed: ${error.message}`);
  return (data ?? []) as unknown as EventListItem[];
}

export async function listCities(): Promise<City[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("cities")
    .select("id, slug, name_ka, name_en")
    .eq("is_active", true)
    .order("name_en");
  if (error) throw new Error(`listCities failed: ${error.message}`);
  return (data ?? []) as City[];
}

export async function listCategories(): Promise<Category[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name_ka, name_en, icon, sort_order")
    .order("sort_order");
  if (error) throw new Error(`listCategories failed: ${error.message}`);
  return (data ?? []) as Category[];
}
