import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EventGrid } from "@/components/EventGrid";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { CITY_COOKIE, resolveActiveCity } from "@/lib/city-cookie";
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

  const [tonight, weekend, upcoming] = await Promise.all([
    listEvents({ citySlug, when: "tonight", freeOnly: false }, 8),
    listEvents({ citySlug, when: "weekend", freeOnly: false }, 8),
    listEvents({ citySlug, when: "any", freeOnly: false }, 12),
  ]);

  const browseHref = citySlug ? `/${locale}/${citySlug}` : `/${locale}`;

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug={citySlug ?? ""} />
      <main className="container">
        {tonight.items.length > 0 && (
          <section className={styles.section}>
            <div className={styles.heading}>
              <h2 className={styles.title}>{t("tonight")}</h2>
              <Link className={styles.more} href={`${browseHref}?when=tonight`}>
                {t("seeAll")}
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
                {t("seeAll")}
              </Link>
            </div>
            <EventGrid events={weekend.items} locale={locale} />
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.heading}>
            <h2 className={styles.title}>{t("allEvents")}</h2>
            <Link className={styles.more} href={browseHref}>
              {t("seeAll")}
            </Link>
          </div>
          <EventGrid events={upcoming.items} locale={locale} />
        </section>
      </main>
    </>
  );
}
