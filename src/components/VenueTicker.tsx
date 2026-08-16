import styles from "./VenueTicker.module.scss";

/**
 * Venues with something on tonight, crawling past like the lit listings board
 * outside a club. Hovering pauses it; reduced-motion stops it entirely.
 *
 * The content is real — these are the venues actually open tonight — so the
 * motion carries information rather than decorating the page.
 */
export function VenueTicker({ names }: { names: string[] }) {
  if (names.length === 0) return null;

  // Rendered twice so the -50% translation loops without a visible seam.
  const group = (key: string) => (
    <div className={styles.group} key={key} aria-hidden={key === "b"}>
      {names.map((name, i) => (
        <span key={`${key}-${name}-${i}`} className={styles.name}>
          {name}
          <span className={styles.dot}> ◆</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className={styles.strip}>
      <div className={styles.track}>
        {group("a")}
        {group("b")}
      </div>
    </div>
  );
}
