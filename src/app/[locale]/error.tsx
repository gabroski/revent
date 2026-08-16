"use client";

import { useTranslations } from "next-intl";
import styles from "./status.module.scss";

// A read failure must never render a blank page: an empty discovery site looks closed.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("error");

  return (
    <main className={`container ${styles.wrap}`}>
      <h1 className={styles.title}>{t("title")}</h1>
      <button type="button" className={styles.action} onClick={reset}>
        {t("retry")}
      </button>
    </main>
  );
}
