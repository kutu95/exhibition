import Image from "next/image";
import Link from "next/link";

import type { PlaceContext, PrintEditorial as PrintEditorialContent } from "../lib/print-editorial";
import { PRINT_MAKING_NOTE } from "../lib/print-editorial";
import styles from "./PrintEditorial.module.css";

type PrintEditorialProps = {
  title: string;
  editorial: PrintEditorialContent;
  place: PlaceContext | null;
};

export function PrintEditorial({ title, editorial, place }: PrintEditorialProps) {
  return (
    <section
      className={`container-narrow ${styles.wrap}`}
      aria-label={`About the photograph ${title}`}
      aria-labelledby="print-notes-heading"
    >
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
    </section>
  );
}
