import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EventGrid } from "@/components/EventGrid";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import { getVenueBySlug, listCities, listVenueEvents } from "@/modules/discovery/queries";
import styles from "./page.module.scss";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const venue = await getVenueBySlug(slug);
  if (!venue) return {};

  return {
    title: pickContent(venue, "name", locale) ?? "",
    description: pickContent(venue, "description", locale)?.slice(0, 160),
    alternates: { languages: { ka: `/ka/venues/${slug}`, en: `/en/venues/${slug}` } },
  };
}

export default async function VenuePage({ params }: Props) {
  const { locale, slug } = await params;
  const [venue, cities] = await Promise.all([getVenueBySlug(slug), listCities()]);
  if (!venue) notFound();

  const [events, t] = await Promise.all([
    listVenueEvents(venue.id),
    getTranslations("event"),
  ]);

  const description = pickContent(venue, "description", locale);
  const address = pickContent(venue, "address", locale);
  const cityName = pickContent(venue.city, "name", locale);

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug={venue.city.slug} />
      <main className="container">
        <div className={styles.header}>
          <h1 className={styles.name}>
            {pickContent(venue, "name", locale)}
            {venue.is_verified && " ✓"}
          </h1>
          <p className={styles.where}>{[address, cityName].filter(Boolean).join(", ")}</p>
          {description && <p className={styles.description}>{description}</p>}
          <div className={styles.links}>
            {venue.instagram && (
              <a
                href={`https://instagram.com/${venue.instagram}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                Instagram
              </a>
            )}
            {venue.website && (
              <a href={venue.website} target="_blank" rel="noreferrer noopener">
                {venue.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {venue.phone && <a href={`tel:${venue.phone}`}>{venue.phone}</a>}
          </div>
        </div>

        <h2 className={styles.upcoming}>{t("upcoming")}</h2>
        <EventGrid events={events} locale={locale} />
      </main>
    </>
  );
}
