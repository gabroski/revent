import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ProfileForm } from "@/components/auth/ProfileForm";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { getSessionUser } from "@/lib/supabase/session";
import { logoutAction } from "@/modules/auth/actions";
import { listCities } from "@/modules/discovery/queries";
import authStyles from "../auth/auth.module.scss";
import styles from "./page.module.scss";

type Props = { params: Promise<{ locale: Locale }> };

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/auth/login`);

  const [t, cities] = await Promise.all([getTranslations("auth"), listCities()]);

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug="" />
      <main className={authStyles.wrap}>
        <span className={authStyles.eyebrow}>{t("eyebrowProfile")}</span>
        <h1 className={authStyles.title}>{user.displayName}</h1>
        <p className={styles.email}>{user.email}</p>

        <ProfileForm
          locale={locale}
          displayName={user.displayName}
          preferredLocale={user.locale}
        />

        <div className={authStyles.alt}>
          <form action={logoutAction.bind(null, locale)}>
            <button className={styles.logout} type="submit">
              {t("signOut")}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
