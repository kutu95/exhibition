"use client";

import { useMemo, useState } from "react";

import { buildWallProductUrl } from "../../lib/exhibition-links";
import { sortWallQrProducts, WALL_QR_LABELS_PER_PAGE } from "../../lib/wall-qr-label-layout";
import styles from "./WallQrLabelsClient.module.css";

export type WallQrProduct = {
  title: string;
  slug: string;
  location_tag: string | null;
  visibility: "public" | "vault";
};

type WallQrLabelsClientProps = {
  products: WallQrProduct[];
};

export function WallQrLabelsClient({ products }: WallQrLabelsClientProps) {
  const [includePrivate, setIncludePrivate] = useState(true);

  const labels = useMemo(() => {
    const filtered = includePrivate ? products : products.filter((product) => product.visibility !== "vault");
    return sortWallQrProducts(filtered);
  }, [includePrivate, products]);

  const privateCount = products.filter((product) => product.visibility === "vault").length;
  const sheetCount = Math.ceil(labels.length / WALL_QR_LABELS_PER_PAGE);

  return (
    <div>
      <div className={styles.screenOnly}>
        <h1>Wall QR labels</h1>
        <p className={styles.lead}>
          Print a batch of 5&nbsp;cm × 5&nbsp;cm QR codes to cut out and paste beside each photograph. A phone camera
          opens that print in wall mode.
        </p>
        <p className={styles.hint}>
          Download the PDF and print at <strong>100% / Actual size</strong> (turn off “fit to page”). Each square is
          exactly 5&nbsp;cm. The title under the square is only for matching — trim it off if you want the QR alone on
          the wall.
        </p>
        <div className={styles.actions}>
          <a
            className={styles.primary}
            href={includePrivate ? "/api/admin/wall-qr-labels" : "/api/admin/wall-qr-labels?vault=0"}
          >
            Download PDF
          </a>
          <button className={styles.secondary} type="button" onClick={() => window.print()}>
            Print this page
          </button>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={includePrivate}
              onChange={(event) => setIncludePrivate(event.target.checked)}
            />
            Include private collection ({privateCount})
          </label>
        </div>
        <p className={styles.count}>
          {labels.length} photograph{labels.length === 1 ? "" : "s"} · {sheetCount} A4 sheet
          {sheetCount === 1 ? "" : "s"} of labels (12 per page)
        </p>
      </div>

      <section className={styles.sheets} aria-label="Printable QR labels">
        {Array.from({ length: sheetCount }, (_, sheet) => {
          const slice = labels.slice(sheet * WALL_QR_LABELS_PER_PAGE, (sheet + 1) * WALL_QR_LABELS_PER_PAGE);
          return (
            <article key={sheet} className={styles.sheet}>
              {slice.map((product, indexOnPage) => {
                const wallUrl = buildWallProductUrl(product.slug);
                const qrSrc = `/api/qr?size=512&data=${encodeURIComponent(wallUrl)}`;
                const number = sheet * WALL_QR_LABELS_PER_PAGE + indexOnPage + 1;
                return (
                  <figure key={product.slug} className={styles.cell}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={styles.qr} src={qrSrc} alt={`QR code for ${product.title}`} />
                    <figcaption>
                      <span className={styles.title}>
                        {number}. {product.title}
                        {product.visibility === "vault" ? " · private" : ""}
                      </span>
                      <span className={styles.meta}>{product.location_tag || "Other"}</span>
                    </figcaption>
                  </figure>
                );
              })}
            </article>
          );
        })}
      </section>
    </div>
  );
}
