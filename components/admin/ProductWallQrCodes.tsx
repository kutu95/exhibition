"use client";

import { buildWallProductUrl } from "../../lib/exhibition-links";
import styles from "./ProductWallQrCodes.module.css";

type ProductWallQrCodesProps = {
  slug: string;
  title: string;
};

export function ProductWallQrCodes({ slug, title }: ProductWallQrCodesProps) {
  if (!slug.trim()) {
    return (
      <section className={styles.panel}>
        <h2>Wall QR code</h2>
        <p className={styles.muted}>Save the product with a slug first, then print a QR to hang beside the photograph.</p>
      </section>
    );
  }

  const wallUrl = buildWallProductUrl(slug);
  const qrSrc = `/api/qr?size=512&data=${encodeURIComponent(wallUrl)}`;

  return (
    <section className={styles.panel}>
      <h2>Wall QR code</h2>
      <p className={styles.muted}>
        Print this next to <strong>{title || "this photograph"}</strong> on the wall. A phone camera opens the product
        page so the visitor can choose a print size and add it to their cart.
      </p>

      <article className={styles.card}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.qr} src={qrSrc} alt={`QR code for ${title || slug}`} />
        <p className={styles.url}>{wallUrl}</p>
        <div className={styles.actions}>
          <a className={styles.link} href={qrSrc} download={`wall-qr-${slug}.png`}>
            Download PNG
          </a>
          <button className={styles.button} type="button" onClick={() => void navigator.clipboard.writeText(wallUrl)}>
            Copy link
          </button>
        </div>
      </article>
    </section>
  );
}
