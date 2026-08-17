import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type { EventListItem } from "@/modules/discovery/types";
import { EventCard } from "./EventCard";
import styles from "./EventGrid.module.scss";

export async function EventGrid({
  events,
  locale,
  /** The active search query, if any — an empty result reads very differently with one. */
  query,
  /** Where to go to drop the filters. Omitted on pages with no filters. */
  clearHref,
}: {
  events: EventListItem[];
  locale: Locale;
  query?: string;
  clearHref?: string;
}) {
  const t = await getTranslations("empty");

  if (events.length === 0) {
    // A dead end is the worst outcome of a search: always offer the way out.
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>
          {query ? t("queryTitle", { query }) : t("title")}
        </p>
        <p className={styles.emptyBody}>{query ? t("queryBody") : t("body")}</p>
        {clearHref && (
          <Link className={styles.emptyAction} href={clearHref}>
            {query ? t("clearSearch") : t("clearFilters")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {events.map((event) => (
        <EventCard key={event.id} event={event} locale={locale} />
      ))}
    </div>
  );
}
