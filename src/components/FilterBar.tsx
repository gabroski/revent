"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import {
  toSearchParams,
  WHEN_VALUES,
  type EventFilters,
} from "@/modules/discovery/filters";
import type { Category } from "@/modules/discovery/types";
import styles from "./FilterBar.module.scss";

export function FilterBar({
  locale,
  categories,
  filters,
  basePath,
}: {
  locale: Locale;
  categories: Category[];
  filters: EventFilters;
  basePath: string;
}) {
  const router = useRouter();
  const t = useTranslations();

  function apply(next: EventFilters) {
    // A filter change invalidates the cursor: page 2 of the old result set is meaningless.
    const qs = toSearchParams({ ...next, cursor: undefined, citySlug: undefined }).toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }

  return (
    <div className={styles.bar}>
      {WHEN_VALUES.map((when) => (
        <button
          key={when}
          type="button"
          className={filters.when === when ? styles.chipActive : styles.chip}
          onClick={() => apply({ ...filters, when })}
        >
          {t(`when.${when}`)}
        </button>
      ))}

      <span className={styles.spacer} />

      {categories.map((category) => {
        const active = filters.categorySlug === category.slug;
        return (
          <button
            key={category.id}
            type="button"
            className={active ? styles.chipActive : styles.chip}
            onClick={() =>
              apply({ ...filters, categorySlug: active ? undefined : category.slug })
            }
          >
            {pickContent(category, "name", locale)}
          </button>
        );
      })}

      <button
        type="button"
        className={filters.freeOnly ? styles.chipActive : styles.chip}
        onClick={() => apply({ ...filters, freeOnly: !filters.freeOnly })}
      >
        {t("filters.free")}
      </button>
    </div>
  );
}
