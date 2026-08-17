import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/supabase/session";
import type { City } from "@/modules/discovery/types";
import { CitySelect } from "./CitySelect";
import { Logo } from "./Logo";
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
  const [t, tAuth, user] = await Promise.all([
    getTranslations("nav"),
    getTranslations("auth"),
    getSessionUser(),
  ]);

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={`/${locale}`} className={styles.brand} aria-label={t("brand")}>
          <Logo />
        </Link>

        <CitySelect cities={cities} activeSlug={activeCitySlug} locale={locale} />

        <Link
          className={user ? styles.account : styles.signIn}
          href={user ? `/${locale}/profile` : `/${locale}/auth/login`}
        >
          {user ? user.displayName : tAuth("signIn")}
        </Link>

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
