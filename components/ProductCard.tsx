"use client";

import Image from "next/image";
import Link from "next/link";

import type { ProductWithVariantsAndImages } from "../lib/supabase/types";
import { centsToAUD } from "../lib/utils/currency";
import { ProductOrdersButton } from "./admin/ProductOrdersButton";
import { FavouriteButton } from "./FavouriteButton";
import styles from "./ProductCard.module.css";

type ProductCardProps = {
  product: ProductWithVariantsAndImages;
  isAdmin?: boolean;
};

export function ProductCard({ product, isAdmin = false }: ProductCardProps) {
  const primaryImage = product.product_images[0]?.image_url;

  if (!primaryImage) {
    throw new Error(`Missing product image for product: ${product.slug}`);
  }

  const lowestCents =
    product.product_variants.length > 0
      ? Math.min(...product.product_variants.map((variant) => variant.price_aud))
      : 0;
  const fromPrice = `From $${centsToAUD(lowestCents).toFixed(2)}`;

  return (
    <article className={styles.card}>
      <Link href={`/shop/${product.slug}`} className={styles.imageLink} aria-label={product.title}>
        <div className={styles.imageWrap}>
          <Image
            src={primaryImage}
            alt={product.title}
            fill
            className={styles.image}
            sizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 33vw"
          />
        </div>
      </Link>
      {isAdmin ? (
        <div className={styles.adminOverlay}>
          <ProductOrdersButton productId={product.id} productTitle={product.title} />
        </div>
      ) : null}
      <div className={styles.content}>
        <div className={styles.titleRow}>
          <Link href={`/shop/${product.slug}`} className={styles.titleLink}>
            <h3>{product.title}</h3>
          </Link>
          <FavouriteButton productId={product.id} productTitle={product.title} />
        </div>
        <Link href={`/shop/${product.slug}`} className={styles.metaLink}>
          {product.location_tag ? <p className={styles.location}>{product.location_tag}</p> : null}
          <p className={styles.price}>{fromPrice}</p>
        </Link>
      </div>
    </article>
  );
}
