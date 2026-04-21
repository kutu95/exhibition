import Link from "next/link";

import styles from "./HeroVideo.module.css";

type HeroVideoProps = {
  videoSrc?: string;
  posterSrc: string;
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
  return (
    <section className={styles.hero}>
      {videoSrc ? (
        <video className={styles.media} autoPlay muted loop playsInline poster={posterSrc}>
          <source src={videoSrc} />
        </video>
      ) : (
        <div
          className={styles.media}
          style={{
            backgroundImage: `url(${posterSrc})`,
          }}
          aria-hidden
        />
      )}
      <div className={styles.overlay} />
      <div className={`container ${styles.content}`}>
        <p className="eyebrow">SS Georgette Exhibition</p>
        <h1 className="heading-display">{headline}</h1>
        <p>{subheadline}</p>
        <Link href={ctaHref} className={`button-outline ${styles.cta}`}>
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}
