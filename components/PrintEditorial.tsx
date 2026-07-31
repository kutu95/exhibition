import Image from "next/image";
import Link from "next/link";

import type { PlaceContext, PrintEditorial as PrintEditorialContent } from "../lib/print-editorial";
import { PRINT_MAKING_NOTE } from "../lib/print-editorial";
import styles from "./PrintEditorial.module.css";

export type RelatedPrint = {
  slug: string;
  title: string;
  imageUrl: string | null;
};

type PrintEditorialProps = {
  title: string;
  editorial: PrintEditorialContent;
  place: PlaceContext | null;
  related: RelatedPrint[];
};

export function PrintEditorial({ title, editorial, place, related }: PrintEditorialProps) {
  return (
    <section className={`container-narrow ${styles.wrap}`} aria-labelledby="print-notes-heading">
      <h2 id="print-notes-heading" className={styles.heading}>
        About this photograph
      </h2>

      <p className={styles.standfirst}>{editorial.standfirst}</p>

      {editorial.body.map((paragraph) => (
        <p key={paragraph.slice(0, 40)} className={styles.body}>
          {paragraph}
        </p>
      ))}

      {place ? (
        <div className={styles.place}>
          <h2 className={styles.placeHeading}>{place.heading}</h2>
          {place.body.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className={styles.body}>
              {paragraph}
            </p>
          ))}
          <p className={styles.body}>
            The full account of the wreck — the failed pumps, the lifeboat, Grace Bussell and Sam Isaacs, and the
            inquiry that followed — is set out in{" "}
            <Link className="text-link" href="/story">
              the story of the SS Georgette
            </Link>
            . The research behind it is described in{" "}
            <Link className="text-link" href="/book">
              the author&apos;s preface
            </Link>
            .
          </p>
        </div>
      ) : null}

      <h2 className={styles.makingHeading}>About the print</h2>
      <p className={styles.body}>{PRINT_MAKING_NOTE}</p>

      {related.length > 0 ? (
        <nav className={styles.related} aria-label={`Other photographs related to ${title}`}>
          <h2 className={styles.relatedHeading}>Related photographs</h2>
          <ul className={styles.relatedList}>
            {related.map((print) => (
              <li key={print.slug}>
                <Link href={`/shop/${print.slug}`} className={styles.relatedLink}>
                  {print.imageUrl ? (
                    <span className={styles.relatedThumb}>
                      <Image
                        src={print.imageUrl}
                        alt=""
                        fill
                        sizes="120px"
                        className={styles.relatedImage}
                      />
                    </span>
                  ) : null}
                  <span>{print.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </section>
  );
}
