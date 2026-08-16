import { notFound } from "next/navigation";
import { EventGrid } from "@/components/EventGrid";
import { FilterBar } from "@/components/FilterBar";
import { LoadMore } from "@/components/LoadMore";
import { SearchBox } from "@/components/SearchBox";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import { parseFilters, toSearchParams } from "@/modules/discovery/filters";
import { listCategories, listCities, listEvents } from "@/modules/discovery/queries";
import styles from "./page.module.scss";

type Props = {
  params: Promise<{ locale: Locale; city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, city } = await params;
  const cities = await listCities();
  const match = cities.find((c) => c.slug === city);
  if (!match) return {};

  const name = pickContent(match, "name", locale);
  return {
    title: locale === "ka" ? `ღონისძიებები — ${name}` : `Events in ${name}`,
    alternates: {
      languages: { ka: `/ka/${city}`, en: `/en/${city}` },
    },
  };
}

export default async function CityPage({ params, searchParams }: Props) {
  const { locale, city } = await params;
  const cities = await listCities();
  const activeCity = cities.find((c) => c.slug === city);
  if (!activeCity) notFound();

  const filters = { ...parseFilters(await searchParams), citySlug: city };
  const [categories, page] = await Promise.all([listCategories(), listEvents(filters)]);
  const basePath = `/${locale}/${city}`;

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug={city} />
      <main className="container">
        <h1 className={styles.title}>{pickContent(activeCity, "name", locale)}</h1>
        <SearchBox basePath={basePath} filters={filters} />
        <FilterBar
          locale={locale}
          categories={categories}
          filters={filters}
          basePath={basePath}
        />
        <EventGrid events={page.items} locale={locale} />
        {page.nextCursor && (
          <LoadMore
            basePath={basePath}
            searchParams={toSearchParams({ ...filters, citySlug: undefined })}
            cursor={page.nextCursor}
          />
        )}
      </main>
    </>
  );
}
