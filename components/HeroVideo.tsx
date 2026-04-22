import Link from "next/link";

import styles from "./HeroVideo.module.css";

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
        <p>{subheadline}</p>
        <Link href={ctaHref} className={`button-outline ${styles.cta}`}>
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
