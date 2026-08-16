import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type { EventListItem } from "@/modules/discovery/types";
import { EventCard } from "./EventCard";
import styles from "./EventGrid.module.scss";

export async function EventGrid({
  events,
  locale,
}: {
  events: EventListItem[];
  locale: Locale;
}) {
  const t = await getTranslations("empty");

  if (events.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>{t("title")}</p>
        <p>{t("body")}</p>
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
