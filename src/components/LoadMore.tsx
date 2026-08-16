import Link from "next/link";
import { getTranslations } from "next-intl/server";
import styles from "./LoadMore.module.scss";

export async function LoadMore({
  basePath,
  searchParams,
  cursor,
}: {
  basePath: string;
  searchParams: URLSearchParams;
  cursor: string;
}) {
  const t = await getTranslations("filters");
  const next = new URLSearchParams(searchParams);
  next.set("cursor", cursor);

  return (
    <p className={styles.wrap}>
      <Link className={styles.link} href={`${basePath}?${next.toString()}`}>
        {t("more")}
      </Link>
    </p>
  );
}
