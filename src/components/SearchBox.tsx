"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toSearchParams, type EventFilters } from "@/modules/discovery/filters";
import styles from "./SearchBox.module.scss";

export function SearchBox({
  basePath,
  filters,
}: {
  basePath: string;
  filters: EventFilters;
}) {
  const router = useRouter();
  const t = useTranslations("filters");
  const [value, setValue] = useState(filters.q ?? "");

  const current = filters.q ?? "";

  useEffect(() => {
    if (value === current) return;
    const timer = setTimeout(() => {
      const qs = toSearchParams({
        ...filters,
        q: value || undefined,
        cursor: undefined,
        citySlug: undefined,
      }).toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, current, filters, basePath, router]);

  return (
    <input
      className={styles.input}
      type="search"
      value={value}
      placeholder={t("search")}
      onChange={(e) => setValue(e.target.value)}
      aria-label={t("search")}
    />
  );
}
