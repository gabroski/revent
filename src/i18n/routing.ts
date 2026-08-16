import { defineRouting } from "next-intl/routing";

export const locales = ["ka", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ka";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});
