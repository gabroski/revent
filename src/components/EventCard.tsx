import Link from "next/link";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import { formatEventDate, formatPrice } from "@/lib/format";
import type { EventListItem } from "@/modules/discovery/types";
import { Poster } from "./Poster";
import styles from "./EventCard.module.scss";

export function EventCard({
  event,
  locale,
}: {
  event: EventListItem;
  locale: Locale;
}) {
  const title = pickContent(event, "title", locale) ?? "—";
  const venueName = pickContent(event.venue, "name", locale) ?? "";
  const cityName = pickContent(event.city, "name", locale) ?? "";
  const categoryName = pickContent(event.category, "name", locale) ?? "";
  const isFree = event.entry_fee_gel === null;
  const price = formatPrice(event.entry_fee_gel, locale);

  return (
    <Link href={`/${locale}/events/${event.slug}`} className={styles.card}>
      <Poster
        className={styles.poster}
        imagePath={event.poster_image_path}
        title={title}
        kicker={categoryName}
        foot={venueName}
        seed={event.id}
      />

      <div className={styles.stub}>
        <span className={styles.time}>{formatEventDate(event.starts_at, locale)}</span>
        <span className={isFree ? styles.free : styles.price}>{price}</span>
      </div>

      <div className={styles.body}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.category}>{categoryName}</span>
        <span className={styles.venue}>
          {venueName}
          {event.venue.is_verified && (
            <span className={styles.badge} role="img" aria-label="Verified venue">
              {" ✓"}
            </span>
          )}
          {cityName && ` · ${cityName}`}
        </span>
      </div>
    </Link>
  );
}
