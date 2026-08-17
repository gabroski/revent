import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/supabase/session";
import { listCities } from "@/modules/discovery/queries";
import styles from "../auth.module.scss";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("signIn") };
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  if (await getSessionUser()) redirect(`/${locale}/profile`);

  const [t, cities] = await Promise.all([getTranslations("auth"), listCities()]);

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug="" />
      <main className={styles.wrap}>
        <span className={styles.eyebrow}>{t("eyebrowLogin")}</span>
        <h1 className={styles.title}>{t("loginTitle")}</h1>
        <p className={styles.lede}>{t("loginLede")}</p>

        <LoginForm locale={locale} />

        <div className={styles.alt}>
          <Link className={styles.link} href={`/${locale}/auth/forgot`}>
            {t("forgotPassword")}
          </Link>
          <span>
            {t("noAccount")}{" "}
            <Link className={styles.link} href={`/${locale}/auth/register`}>
              {t("createAccount")}
            </Link>
          </span>
        </div>
      </main>
    </>
  );
}
