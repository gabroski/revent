import type { City } from "@/modules/discovery/types";

export const CITY_COOKIE = "revent_city";
const DEFAULT_CITY_SLUG = "tbilisi";

/** A cookie is user input: an unknown slug falls back rather than being trusted. */
export function resolveActiveCity(
  cookieValue: string | undefined,
  cities: City[],
): City | null {
  if (cities.length === 0) return null;
  return (
    cities.find((c) => c.slug === cookieValue) ??
    cities.find((c) => c.slug === DEFAULT_CITY_SLUG) ??
    cities[0]
  );
}
