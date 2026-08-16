import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EventGrid } from "@/components/EventGrid";
import { SiteHeader } from "@/components/SiteHeader";
import { VenueTicker } from "@/components/VenueTicker";
import type { Locale } from "@/i18n/routing";
import { CITY_COOKIE, resolveActiveCity } from "@/lib/city-cookie";
import { pickContent } from "@/lib/content";
import { formatEventDate } from "@/lib/format";
import { listCities, listEvents } from "@/modules/discovery/queries";
import styles from "./page.module.scss";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("home");

  const cities = await listCities();
  const activeCity = resolveActiveCity((await cookies()).get(CITY_COOKIE)?.value, cities);
  const citySlug = activeCity?.slug;
  const cityName = activeCity ? pickContent(activeCity, "name", locale) : "";

  const [tonight, weekend, upcoming] = await Promise.all([
    listEvents({ citySlug, when: "tonight", freeOnly: false }, 8),
    listEvents({ citySlug, when: "weekend", freeOnly: false }, 8),
    listEvents({ citySlug, when: "any", freeOnly: false }, 12),
  ]);

  const browseHref = citySlug ? `/${locale}/${citySlug}` : `/${locale}`;

  // The hero answers one question: is anything on tonight, and what starts next.
  const count = tonight.items.length;
  const nextUp = tonight.items[0];

  const tickerNames = Array.from(
    new Set(
      (count > 0 ? tonight.items : upcoming.items).map(
        (e) => pickContent(e.venue, "name", locale) ?? "",
      ),
    ),
  ).filter(Boolean);

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug={citySlug ?? ""} />

      <section className={styles.hero}>
        <div className="container">
          <span className={styles.eyebrow}>
            {t("eyebrow", { city: cityName ?? "" })}
          </span>
          <h1 className={styles.statement}>
            {count > 0 ? (
              t.rich("statement", {
                count,
                n: (chunks) => <span className={styles.count}>{chunks}</span>,
              })
            ) : (
              t("statementEmpty")
            )}
          </h1>
          <p className={styles.sub}>{t("sub")}</p>

          {nextUp && (
            <div className={styles.next}>
              <span>{t("nextUp")}</span>
              <span className={styles.nextTitle}>
                {formatEventDate(nextUp.starts_at, locale)} ·{" "}
                {pickContent(nextUp.venue, "name", locale)}
              </span>
            </div>
          )}
        </div>
      </section>

      <VenueTicker names={tickerNames} />

      <main className="container">
        {count > 0 && (
          <section className={styles.section}>
            <div className={styles.heading}>
              <h2 className={styles.title}>{t("tonight")}</h2>
              <Link className={styles.more} href={`${browseHref}?when=tonight`}>
                {t("seeAll")} →
              </Link>
            </div>
            <EventGrid events={tonight.items} locale={locale} />
          </section>
        )}

        {weekend.items.length > 0 && (
          <section className={styles.section}>
            <div className={styles.heading}>
              <h2 className={styles.title}>{t("weekend")}</h2>
              <Link className={styles.more} href={`${browseHref}?when=weekend`}>
                {t("seeAll")} →
              </Link>
            </div>
            <EventGrid events={weekend.items} locale={locale} />
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.heading}>
            <h2 className={styles.title}>{t("allEvents")}</h2>
            <Link className={styles.more} href={browseHref}>
              {t("seeAll")} →
            </Link>
          </div>
          <EventGrid events={upcoming.items} locale={locale} />
        </section>

        <footer className={styles.footer}>{t("footer")}</footer>
      </main>
    </>
  );
}
