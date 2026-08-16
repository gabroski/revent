export const WHEN_VALUES = ["any", "tonight", "tomorrow", "weekend", "week"] as const;
export type WhenFilter = (typeof WHEN_VALUES)[number];

export type EventFilters = {
  citySlug?: string;
  categorySlug?: string;
  when: WhenFilter;
  freeOnly: boolean;
  q?: string;
  cursor?: string;
};

const TZ_OFFSET_HOURS = 4; // Georgia, no DST
const NIGHT_ENDS_HOUR = 6; // a night belongs to the evening it started, until 6am

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): EventFilters {
  const when = first(params.when);
  const filters: EventFilters = {
    when: (WHEN_VALUES as readonly string[]).includes(when ?? "")
      ? (when as WhenFilter)
      : "any",
    freeOnly: first(params.free) === "1",
  };
  const city = first(params.city);
  const category = first(params.category);
  const q = first(params.q);
  const cursor = first(params.cursor);
  if (city) filters.citySlug = city;
  if (category) filters.categorySlug = category;
  if (q) filters.q = q;
  if (cursor) filters.cursor = cursor;
  return filters;
}

export function toSearchParams(filters: EventFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.citySlug) params.set("city", filters.citySlug);
  if (filters.categorySlug) params.set("category", filters.categorySlug);
  if (filters.when !== "any") params.set("when", filters.when);
  if (filters.freeOnly) params.set("free", "1");
  if (filters.q) params.set("q", filters.q);
  if (filters.cursor) params.set("cursor", filters.cursor);
  return params;
}

/**
 * Strips characters a search query has no legitimate use for.
 *
 * Supabase sits behind a WAF that inspects request URLs, and punctuation like
 * `';--` reads as an injection attempt — the request is blocked with an HTML
 * error page before it ever reaches Postgres. PostgREST parameterizes properly
 * so this is not a security fix; it keeps ordinary input (an apostrophe in a
 * venue name) from tripping the WAF.
 */
export function sanitizeQuery(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/** Local (UTC+4) wall-clock parts, so "tonight" means tonight in Georgia. */
function localParts(date: Date) {
  const shifted = new Date(date.getTime() + TZ_OFFSET_HOURS * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(), // 0 = Sunday
  };
}

function localDate(year: number, month: number, day: number, hour: number): Date {
  return new Date(Date.UTC(year, month, day, hour - TZ_OFFSET_HOURS, 0, 0, 0));
}

function notBefore(candidate: Date, floor: Date): Date {
  return candidate.getTime() < floor.getTime() ? floor : candidate;
}

export function resolveDateRange(
  when: WhenFilter,
  now: Date,
): { from: Date; to: Date | null } {
  const p = localParts(now);

  // Before 6am the current night started yesterday, so it ends this morning.
  const nightEnd =
    p.hour < NIGHT_ENDS_HOUR
      ? localDate(p.year, p.month, p.day, NIGHT_ENDS_HOUR)
      : localDate(p.year, p.month, p.day + 1, NIGHT_ENDS_HOUR);

  switch (when) {
    case "any":
      return { from: now, to: null };

    case "tonight":
      return { from: now, to: nightEnd };

    case "tomorrow":
      return {
        from: notBefore(nightEnd, now),
        to: new Date(nightEnd.getTime() + 24 * 3_600_000),
      };

    case "weekend": {
      // Friday, Saturday, Sunday: the weekend is already underway.
      const daysToMonday: Record<number, number> = { 5: 3, 6: 2, 0: 1 };
      if (p.weekday in daysToMonday) {
        return {
          from: now,
          to: localDate(p.year, p.month, p.day + daysToMonday[p.weekday], NIGHT_ENDS_HOUR),
        };
      }
      const daysUntilFriday = (5 - p.weekday + 7) % 7;
      return {
        from: notBefore(localDate(p.year, p.month, p.day + daysUntilFriday, 18), now),
        to: localDate(p.year, p.month, p.day + daysUntilFriday + 3, NIGHT_ENDS_HOUR),
      };
    }

    case "week":
      return { from: now, to: localDate(p.year, p.month, p.day + 7, NIGHT_ENDS_HOUR) };
  }
}
