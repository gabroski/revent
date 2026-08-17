import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/supabase/session";
import { listCities } from "@/modules/discovery/queries";
import styles from "../auth.module.scss";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  return { title: t("createAccount") };
}

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;

  // Already signed in: the form would be confusing rather than useful.
  if (await getSessionUser()) redirect(`/${locale}/profile`);

  const [t, cities] = await Promise.all([
    getTranslations("auth"),
    listCities(),
  ]);

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug="" />
      <main className={styles.wrap}>
        <span className={styles.eyebrow}>{t("eyebrowRegister")}</span>
        <h1 className={styles.title}>{t("registerTitle")}</h1>
        <p className={styles.lede}>{t("registerLede")}</p>

        <RegisterForm locale={locale} />

        <div className={styles.alt}>
          <span>
            {t("haveAccount")}{" "}
            <Link className={styles.link} href={`/${locale}/auth/login`}>
              {t("signIn")}
            </Link>
          </span>
        </div>
      </main>
    </>
  );
}
