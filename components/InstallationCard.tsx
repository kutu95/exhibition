import Image from "next/image";
import Link from "next/link";

import styles from "./InstallationCard.module.css";

type InstallationCardProps = {
  title: string;
  description: string;
  imageSrc: string;
  slug: string;
};

export function InstallationCard({ title, description, imageSrc, slug }: InstallationCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.imageWrap}>
        <Image
          src={imageSrc}
          alt={title}
          fill
          className={styles.image}
          sizes="(max-width: 900px) 100vw, 40vw"
        />
      </div>
      <div className={styles.content}>
        <p className="eyebrow">Installation</p>
        <h3>{title}</h3>
        <p>{description}</p>
        <Link href={`/installations#${slug}`} className={styles.link}>
          Learn more →
        </Link>
      </div>
    </article>
  );
}
