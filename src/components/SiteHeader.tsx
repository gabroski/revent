import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type { City } from "@/modules/discovery/types";
import { CitySelect } from "./CitySelect";
import styles from "./SiteHeader.module.scss";

export async function SiteHeader({
  locale,
  cities,
  activeCitySlug,
}: {
  locale: Locale;
  cities: City[];
  activeCitySlug: string;
}) {
  const t = await getTranslations("nav");

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={`/${locale}`} className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          {t("brand")}
        </Link>
        <CitySelect cities={cities} activeSlug={activeCitySlug} locale={locale} />
        <div className={styles.langs}>
          <Link href="/ka" className={locale === "ka" ? styles.active : undefined}>
            ქარ
          </Link>
          <span className={styles.langDivider} aria-hidden="true">
            /
          </span>
          <Link href="/en" className={locale === "en" ? styles.active : undefined}>
            EN
          </Link>
        </div>
      </div>
    </header>
  );
}
