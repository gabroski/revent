import Link from "next/link";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import { formatEventDate, formatPrice } from "@/lib/format";
import { publicImageUrl } from "@/lib/images";
import type { EventListItem } from "@/modules/discovery/types";
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

  return (
    <Link href={`/${locale}/events/${event.slug}`} className={styles.card}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.poster}
        src={publicImageUrl(event.poster_image_path)}
        alt=""
        loading="lazy"
      />
      <div className={styles.body}>
        <span className={styles.date}>{formatEventDate(event.starts_at, locale)}</span>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.venue}>
          {venueName}
          {event.venue.is_verified && (
            <span className={styles.badge} role="img" aria-label="Verified venue">
              {" ✓"}
            </span>
          )}
          {cityName && ` · ${cityName}`}
        </span>
        <div className={styles.meta}>
          <span>{categoryName}</span>
          <span>·</span>
          <span>{formatPrice(event.entry_fee_gel, locale)}</span>
        </div>
      </div>
    </Link>
  );
}
