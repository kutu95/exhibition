"use client";

import Image from "next/image";
import { ReactNode, useMemo, useState } from "react";

import type { ProductWithVariantsAndImages } from "../lib/supabase/types";
import { formatAUD } from "../lib/utils/currency";
import styles from "./ProductDetailClient.module.css";

type ProductDetailClientProps = {
  product: ProductWithVariantsAndImages;
  shareButtons?: ReactNode;
};

export function ProductDetailClient({ product, shareButtons }: ProductDetailClientProps) {
  const [activeImage, setActiveImage] = useState(product.product_images[0]?.image_url);
  const [selectedVariantId, setSelectedVariantId] = useState(product.product_variants[0]?.id ?? "");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedVariant = useMemo(
    () => product.product_variants.find((variant) => variant.id === selectedVariantId),
    [product.product_variants, selectedVariantId],
  );

  const maxEditionSize = useMemo(() => {
    const sizes = product.product_variants
      .map((variant) => variant.edition_size)
      .filter((size): size is number => typeof size === "number");
    return sizes.length > 0 ? Math.max(...sizes) : null;
  }, [product.product_variants]);

  const handleCheckout = async () => {
    if (!selectedVariant) return;

    try {
      setIsCheckingOut(true);
      setError(null);

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ variant_id: selectedVariant.id, quantity: 1 }],
        }),
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Checkout request failed.");
      }

      window.location.href = data.url;
    } catch (checkoutError) {
      console.error(checkoutError);
      setError("Unable to start checkout. Please try again.");
      setIsCheckingOut(false);
    }
  };

  return (
    <section className={`section container ${styles.wrap}`}>
      <div className={styles.gallery}>
        <div className={styles.mainImageWrap}>
          <Image
            src={activeImage ?? "/images/placeholder-product.jpg"}
            alt={product.title}
            fill
            className={styles.mainImage}
            sizes="(max-width: 950px) 100vw, 60vw"
          />
        </div>

        {product.product_images.length > 1 ? (
          <div className={styles.thumbs}>
            {product.product_images.map((image) => (
              <button
                key={image.id}
                type="button"
                className={`${styles.thumb} ${activeImage === image.image_url ? styles.thumbActive : ""}`}
                onClick={() => setActiveImage(image.image_url)}
                aria-label={`Show image ${image.alt_text ?? product.title}`}
              >
                <Image
                  src={image.image_url}
                  alt={image.alt_text ?? product.title}
                  fill
                  className={styles.thumbImage}
                  sizes="120px"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <aside className={styles.sidebar}>
        {product.location_tag ? <p className="eyebrow">{product.location_tag}</p> : null}
        <h1 className={styles.title}>{product.title}</h1>
        {maxEditionSize ? <p className={styles.edition}>Edition of {maxEditionSize}</p> : null}

        <div className={styles.variants}>
          {product.product_variants.map((variant) => (
            <label
              key={variant.id}
              className={`${styles.variantRow} ${selectedVariantId === variant.id ? styles.variantActive : ""}`}
            >
              <input
                type="radio"
                name="variant"
                checked={selectedVariantId === variant.id}
                onChange={() => setSelectedVariantId(variant.id)}
              />
              <span>{variant.variant_label}</span>
              <span>{formatAUD(variant.price_aud)}</span>
            </label>
          ))}
        </div>

        <p className={styles.price}>
          {selectedVariant ? formatAUD(selectedVariant.price_aud) : "Price unavailable"}
        </p>

        <button className={`button-solid ${styles.buyButton}`} onClick={handleCheckout} disabled={isCheckingOut}>
          {isCheckingOut ? "Redirecting..." : "Add to cart / Buy now"}
        </button>

        {error ? <p className={styles.error}>{error}</p> : null}

        {product.description ? <p className={styles.description}>{product.description}</p> : null}
        {shareButtons ? <div className={styles.shareRow}>{shareButtons}</div> : null}
        <p className={styles.meta}>Made to order · Archival quality · Free shipping within Australia</p>
      </aside>
    </section>
  );
}
