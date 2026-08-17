import Image from "next/image";
import styles from "./Logo.module.scss";

/**
 * The brand lockup: the supplied R mark, with the wordmark set in the site's
 * display face rather than taken from the logo file.
 *
 * The file's own wordmark is near-black and would disappear against the
 * plum-black background, so only the mark is used as artwork.
 */
export function Logo({
  size = "header",
  showWordmark = true,
}: {
  size?: "header" | "large";
  showWordmark?: boolean;
}) {
  const px = size === "large" ? 64 : 30;

  return (
    <span className={size === "large" ? styles.lockupLarge : styles.lockup}>
      <Image
        className={styles.mark}
        src="/logo-mark.png"
        alt=""
        width={px}
        height={px}
        priority={size === "header"}
      />
      {showWordmark && <span className={styles.word}>Revent</span>}
    </span>
  );
}
