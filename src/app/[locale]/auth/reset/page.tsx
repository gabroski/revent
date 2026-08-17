import { getTranslations } from "next-intl/server";
import { SimpleAuthForm } from "@/components/auth/SimpleAuthForm";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { resetAction } from "@/modules/auth/actions";
import { listCities } from "@/modules/discovery/queries";
import styles from "../auth.module.scss";

type Props = { params: Promise<{ locale: Locale }> };

/**
 * Reached from the emailed reset link. Supabase establishes a recovery session
 * from the link's token before this page renders, so updateUser() below is
 * authenticated even though the visitor never typed a password.
 */
export default async function ResetPage({ params }: Props) {
  const { locale } = await params;
  const [t, cities] = await Promise.all([getTranslations("auth"), listCities()]);

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug="" />
      <main className={styles.wrap}>
        <span className={styles.eyebrow}>{t("eyebrowReset")}</span>
        <h1 className={styles.title}>{t("resetTitle")}</h1>
        <p className={styles.lede}>{t("resetLede")}</p>

        <SimpleAuthForm
          action={resetAction.bind(null, locale)}
          fields={[
            {
              name: "password",
              label: "newPassword",
              type: "password",
              autoComplete: "new-password",
            },
            {
              name: "confirm",
              label: "confirmPassword",
              type: "password",
              autoComplete: "new-password",
            },
          ]}
          submitLabel="savePassword"
          pendingLabel="saving"
        />
      </main>
    </>
  );
}
