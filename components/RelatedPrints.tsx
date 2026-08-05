import Image from "next/image";
import Link from "next/link";

import type { RelatedPrint } from "../lib/related-prints";
import styles from "./RelatedPrints.module.css";

type RelatedPrintsProps = {
  title: string;
  related: RelatedPrint[];
};

export function RelatedPrints({ title, related }: RelatedPrintsProps) {
  if (related.length === 0) return null;

  return (
    <nav className={`container ${styles.wrap}`} aria-label={`Photographs related to ${title}`}>
      <h2 className={styles.heading}>Related photographs</h2>
      <ul className={styles.list}>
        {related.map((print) => (
          <li key={print.slug}>
            <Link href={`/shop/${print.slug}`} className={styles.link}>
              {print.imageUrl ? (
                <span className={styles.thumb}>
                  <Image src={print.imageUrl} alt="" fill sizes="220px" className={styles.image} />
                </span>
              ) : null}
              <span className={styles.title}>{print.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
