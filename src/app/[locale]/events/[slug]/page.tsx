import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Poster } from "@/components/Poster";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import { formatEventDate, formatPrice } from "@/lib/format";
import { publicImageUrl } from "@/lib/images";
import { getEventBySlug, listCities } from "@/modules/discovery/queries";
import styles from "./page.module.scss";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return {};

  const title = pickContent(event, "title", locale) ?? "";
  const venue = pickContent(event.venue, "name", locale) ?? "";
  return {
    title: `${title} — ${venue}`,
    description: pickContent(event, "description", locale)?.slice(0, 160),
    openGraph: {
      title,
      images: [publicImageUrl(event.poster_image_path)],
    },
    alternates: {
      languages: { ka: `/ka/events/${slug}`, en: `/en/events/${slug}` },
    },
  };
}

export default async function EventPage({ params }: Props) {
  const { locale, slug } = await params;
  const [event, cities] = await Promise.all([getEventBySlug(slug), listCities()]);
  if (!event) notFound();

  const t = await getTranslations("event");
  const title = pickContent(event, "title", locale) ?? "";
  const description = pickContent(event, "description", locale);
  const venueName = pickContent(event.venue, "name", locale) ?? "";
  const address = pickContent(event.venue, "address", locale);
  const cityName = pickContent(event.city, "name", locale);

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug={event.city.slug} />
      <main className="container">
        <div className={styles.layout}>
          <Poster
            className={styles.posterWrap}
            imagePath={event.poster_image_path}
            title={title}
            kicker={pickContent(event.category, "name", locale) ?? ""}
            foot={venueName}
            seed={event.id}
          />
          <div>
            <span className={styles.when}>{formatEventDate(event.starts_at, locale)}</span>
            <h1 className={styles.title}>{title}</h1>
            <Link className={styles.venueLink} href={`/${locale}/venues/${event.venue.slug}`}>
              {venueName}
              {event.venue.is_verified && " ✓"}
            </Link>

            <dl className={styles.facts}>
              <dt className={styles.label}>{t("at")}</dt>
              <dd className={styles.value}>
                {[address, cityName].filter(Boolean).join(", ")}
              </dd>

              <dt className={styles.label}>{pickContent(event.category, "name", locale)}</dt>
              <dd className={styles.priceValue}>
                {formatPrice(event.entry_fee_gel, locale)}
              </dd>

              {event.dress_code && (
                <>
                  <dt className={styles.label}>{t("dressCode")}</dt>
                  <dd className={styles.value}>{event.dress_code}</dd>
                </>
              )}
            </dl>

            {description && <p className={styles.description}>{description}</p>}
          </div>
        </div>

        {event.images.length > 0 && (
          <div className={styles.gallery}>
            {[...event.images]
              .sort((a, b) => a.position - b.position)
              .map((image) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={image.id}
                  className={styles.galleryImage}
                  src={publicImageUrl(image.image_path)}
                  alt=""
                />
              ))}
          </div>
        )}
      </main>
    </>
  );
}
