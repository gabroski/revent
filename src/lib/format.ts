import type { Locale } from "@/i18n/routing";

// Pinned, not inferred: a UTC server must still render Tbilisi wall-clock time.
const TIME_ZONE = "Asia/Tbilisi";

export function formatEventDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(locale === "ka" ? "ka-GE" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatPrice(gel: number | null, locale: Locale): string {
  if (gel === null) return locale === "ka" ? "უფასო" : "Free";
  return locale === "ka" ? `${gel} ₾` : `${gel} GEL`;
}
