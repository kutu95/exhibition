"use client";

import { useMemo, useState } from "react";

import { buildWallProductUrl } from "../../lib/exhibition-links";
import styles from "./ProductWallQrCodes.module.css";

type WallVariantOption = {
  id: string;
  label: string;
};

type ProductWallQrCodesProps = {
  slug: string;
  title: string;
  productId?: string;
  variants?: WallVariantOption[];
};

export function ProductWallQrCodes({ slug, title, productId, variants = [] }: ProductWallQrCodesProps) {
  const activeVariants = useMemo(
    () => variants.filter((variant) => variant.id.trim() && variant.label.trim()),
    [variants],
  );
  const [hungVariantId, setHungVariantId] = useState("");

  if (!slug.trim()) {
    return (
      <section className={styles.panel}>
        <h2>Wall QR code</h2>
        <p className={styles.muted}>Save the product with a slug first, then print a QR to hang beside the photograph.</p>
      </section>
    );
  }

  const wallUrl = buildWallProductUrl(slug, hungVariantId || undefined);
  const qrSrc = `/api/qr?size=512&data=${encodeURIComponent(wallUrl)}`;
  const onSiteHref = productId
    ? `/admin/on-site?product=${encodeURIComponent(productId)}${
        hungVariantId ? `&variant=${encodeURIComponent(hungVariantId)}` : ""
      }`
    : "/admin/on-site";

  return (
    <section className={styles.panel}>
      <h2>Wall QR code</h2>
      <p className={styles.muted}>
        Print this next to <strong>{title || "this photograph"}</strong> on the wall. A phone camera opens the product
        page in wall mode so the visitor can choose a print size, favourite it, or buy when online sales are open.
      </p>

      {activeVariants.length > 0 ? (
        <label className={styles.hungVariant}>
          Hung size on the wall (optional)
          <select value={hungVariantId} onChange={(event) => setHungVariantId(event.target.value)}>
            <option value="">Visitor chooses size</option>
            {activeVariants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

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
          <a className={styles.link} href="/admin/wall-qr">
            Print all labels
          </a>
          <a className={styles.link} href={onSiteHref}>
            Open in on-site sale
          </a>
        </div>
      </article>
    </section>
  );
}
