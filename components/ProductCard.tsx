import Image from "next/image";
import Link from "next/link";

import type { ProductWithVariantsAndImages } from "../lib/supabase/types";
import { centsToAUD } from "../lib/utils/currency";
import styles from "./ProductCard.module.css";

type ProductCardProps = {
  product: ProductWithVariantsAndImages;
};

export function ProductCard({ product }: ProductCardProps) {
  const primaryImage = product.product_images[0]?.image_url ?? "/images/placeholder-product.jpg";
  const lowestCents =
    product.product_variants.length > 0
      ? Math.min(...product.product_variants.map((variant) => variant.price_aud))
      : 0;
  const fromPrice = `From $${centsToAUD(lowestCents).toFixed(2)}`;

  return (
    <article className={styles.card}>
      <Link href={`/shop/${product.slug}`} className={styles.link}>
        <div className={styles.imageWrap}>
          <Image
            src={primaryImage}
            alt={product.title}
            fill
            className={styles.image}
            sizes="(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 33vw"
          />
        </div>
        <div className={styles.content}>
          <h3>{product.title}</h3>
          {product.location_tag ? <p className={styles.location}>{product.location_tag}</p> : null}
          <p className={styles.price}>{fromPrice}</p>
        </div>
      </Link>
    </article>
  );
}
