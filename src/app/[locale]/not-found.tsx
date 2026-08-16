import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import styles from "./status.module.scss";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  const locale = await getLocale();

  return (
    <main className={`container ${styles.wrap}`}>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.body}>{t("body")}</p>
      <Link className={styles.action} href={`/${locale}`}>
        {t("browse")}
      </Link>
    </main>
  );
}
