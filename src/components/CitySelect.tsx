"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Locale } from "@/i18n/routing";
import { CITY_COOKIE } from "@/lib/city-cookie";
import { pickContent } from "@/lib/content";
import type { City } from "@/modules/discovery/types";
import styles from "./CitySelect.module.scss";

export function CitySelect({
  cities,
  activeSlug,
  locale,
}: {
  cities: City[];
  activeSlug: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(slug: string) {
    document.cookie = `${CITY_COOKIE}=${slug}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <select
      className={styles.select}
      value={activeSlug}
      disabled={isPending}
      onChange={(e) => onChange(e.target.value)}
      aria-label="City"
    >
      {cities.map((city) => (
        <option key={city.id} value={city.slug}>
          {pickContent(city, "name", locale)}
        </option>
      ))}
    </select>
  );
}
