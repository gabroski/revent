import { publicImageUrl } from "@/lib/images";
import styles from "./Poster.module.scss";

const TONES = 5;

/** Deterministic so a given event always gets the same poster colour. */
function toneFor(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100_000;
  }
  return hash % TONES;
}

/** Seeded placeholder paths are not real artwork, whatever the column says. */
function hasArtwork(path: string | null | undefined): boolean {
  return Boolean(path) && !path!.includes("placeholder");
}

/**
 * An event's poster, or a generated one built from its own words.
 *
 * Most venues will not upload artwork, and a grid of grey boxes makes the whole
 * product look broken. Setting the title in the display face against a seeded
 * colour keeps an artwork-less listing looking deliberate.
 */
export function Poster({
  imagePath,
  title,
  kicker,
  foot,
  seed,
  className,
}: {
  imagePath: string | null;
  title: string;
  kicker: string;
  foot: string;
  seed: string;
  className?: string;
}) {
  if (hasArtwork(imagePath)) {
    return (
      <div className={`${styles.frame} ${className ?? ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.photo}
          src={publicImageUrl(imagePath!)}
          alt=""
          loading="lazy"
        />
      </div>
    );
  }

  const tone = styles[`tone${toneFor(seed)}` as keyof typeof styles];

  return (
    <div className={`${styles.frame} ${className ?? ""}`}>
      <div className={`${styles.generated} ${tone}`}>
        <span className={styles.kicker}>{kicker}</span>
        <span className={styles.headline}>{title}</span>
        <span className={styles.foot}>{foot}</span>
      </div>
    </div>
  );
}
