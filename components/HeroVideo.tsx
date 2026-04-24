import Link from "next/link";

import styles from "./HeroVideo.module.css";

const exploreLinks = [
  { href: "/story", label: "Story" },
  { href: "/installations", label: "Installations" },
  { href: "/shop", label: "Photographs" },
  { href: "/visit", label: "Visit" },
] as const;

type HeroVideoProps = {
  videoSrc?: string;
  posterSrc?: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaHref: string;
};

export function HeroVideo({
  videoSrc,
  posterSrc,
  headline,
  subheadline,
  ctaLabel,
  ctaHref,
}: HeroVideoProps) {
  const resolvedPosterSrc = posterSrc?.trim() ? posterSrc : "/images/holding-bg.jpg";
  const resolvedVideoSrc = videoSrc?.trim() ? videoSrc : undefined;

  return (
    <section className={styles.hero}>
      {resolvedVideoSrc ? (
        <video className={styles.media} autoPlay muted loop playsInline poster={resolvedPosterSrc}>
          <source src={resolvedVideoSrc} />
        </video>
      ) : (
        <div
          className={styles.media}
          style={{
            backgroundImage: `url(${resolvedPosterSrc})`,
          }}
          aria-hidden
        />
      )}
      <div className={styles.overlay} />
      <div className={`container ${styles.content}`}>
        <p className="eyebrow">MARGARET RIVER REGION OPEN STUDIOS · 12–27 SEPTEMBER 2026</p>
        <h1 className="heading-display">{headline}</h1>
        <p className={styles.subheadline}>{subheadline}</p>
        <nav className={styles.explore} aria-label="Explore the site">
          <span className={styles.explorePrefix}>
            <span className={styles.exploreLead}>Explore: </span>
            {exploreLinks.map((link, index) => (
              <span key={link.href} className={styles.exploreGroup}>
                {index > 0 ? (
                  <span className={styles.exploreSep} aria-hidden>
                    {" "}
                    ·{" "}
                  </span>
                ) : null}
                <Link href={link.href} className={styles.exploreLink}>
                  {link.label}
                </Link>
              </span>
            ))}
          </span>
        </nav>
        <Link href={ctaHref} className={`button-outline ${styles.cta}`}>
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
