import type { Locale } from "@/i18n/routing";

const OTHER: Record<Locale, Locale> = { ka: "en", en: "ka" };

function value(row: Record<string, unknown>, key: string): string | null {
  const raw = row[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Reads a translatable content field, falling back to the other locale.
 *
 * Venues fill one language, rarely both. Rendering a blank card to an English
 * visitor because the venue wrote in Georgian is worse than showing Georgian.
 */
export function pickContent(
  row: Record<string, unknown>,
  field: string,
  locale: Locale,
): string | null {
  return value(row, `${field}_${locale}`) ?? value(row, `${field}_${OTHER[locale]}`);
}
