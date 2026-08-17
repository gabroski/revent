import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SimpleAuthForm } from "@/components/auth/SimpleAuthForm";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { forgotAction } from "@/modules/auth/actions";
import { listCities } from "@/modules/discovery/queries";
import styles from "../auth.module.scss";

type Props = { params: Promise<{ locale: Locale }> };

export default async function ForgotPage({ params }: Props) {
  const { locale } = await params;
  const [t, cities] = await Promise.all([getTranslations("auth"), listCities()]);

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug="" />
      <main className={styles.wrap}>
        <span className={styles.eyebrow}>{t("eyebrowForgot")}</span>
        <h1 className={styles.title}>{t("forgotTitle")}</h1>
        <p className={styles.lede}>{t("forgotLede")}</p>

        <SimpleAuthForm
          action={forgotAction.bind(null, locale)}
          fields={[
            { name: "email", label: "email", type: "email", autoComplete: "email" },
          ]}
          submitLabel="sendResetLink"
          pendingLabel="sending"
        />

        <div className={styles.alt}>
          <Link className={styles.link} href={`/${locale}/auth/login`}>
            {t("backToLogin")}
          </Link>
        </div>
      </main>
    </>
  );
}
