"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { useCart } from "./CartProvider";
import { FavouriteButton } from "./FavouriteButton";
import { usePurchasesAllowed } from "./PurchasesAccessProvider";
import { readCart } from "../lib/cart";
import { PlausibleEvents, trackEvent } from "../lib/plausible";
import { PURCHASES_DISABLED_MESSAGE } from "../lib/purchases-access";
import type { ProductWithVariantsAndImages } from "../lib/supabase/types";
import { formatAUD } from "../lib/utils/currency";
import styles from "./ProductDetailClient.module.css";

type ProductDetailClientProps = {
  product: ProductWithVariantsAndImages;
  shareButtons?: ReactNode;
};

export function ProductDetailClient({ product, shareButtons }: ProductDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const primaryImage = product.product_images[0]?.image_url ?? "";
  const preselectVariantId = searchParams.get("variant");
  const initialVariantId =
    product.product_variants.find((variant) => variant.id === preselectVariantId)?.id ??
    product.product_variants[0]?.id ??
    "";

  const [activeImage, setActiveImage] = useState(primaryImage);
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariantId);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addItem, itemCount } = useCart();
  const purchasesAllowed = usePurchasesAllowed();

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

  useEffect(() => {
    if (!preselectVariantId) return;
    const match = product.product_variants.find((variant) => variant.id === preselectVariantId);
    if (match) setSelectedVariantId(match.id);
  }, [preselectVariantId, product.product_variants]);

  if (!primaryImage) {
    throw new Error(`Missing product image for product: ${product.slug}`);
  }

  const cartLine = () => {
    if (!selectedVariant) return null;
    return {
      variant_id: selectedVariant.id,
      product_title: product.title,
      variant_label: selectedVariant.variant_label,
      price_aud: selectedVariant.price_aud,
      slug: product.slug,
      image_url: primaryImage,
      quantity: 1 as const,
    };
  };

  const handleAddToCart = () => {
    if (!purchasesAllowed) return;
    const item = cartLine();
    if (!item || !selectedVariant) return;
    setError(null);
    addItem(item);
    trackEvent(PlausibleEvents.SHOP_ADD_TO_CART, {
      product: product.title,
      variant: selectedVariant.variant_label,
      price: selectedVariant.price_aud,
    });
    router.push("/cart");
  };

  const handleBuyNow = async () => {
    if (!purchasesAllowed) return;
    const item = cartLine();
    if (!item || !selectedVariant) return;

    try {
      setIsCheckingOut(true);
      setError(null);

      // Always include the current item, then checkout the full cart so
      // existing cart lines are never skipped by a single-item Buy now.
      addItem(item);
      const checkoutItems = readCart().map((row) => ({
        variant_id: row.variant_id,
        quantity: row.quantity,
      }));

      trackEvent(PlausibleEvents.SHOP_CHECKOUT_START, {
        product: product.title,
        variant: selectedVariant.variant_label,
        price: selectedVariant.price_aud,
        items: checkoutItems.length,
      });

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: checkoutItems }),
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
        <div
          className={styles.mainImageWrap}
          style={
            imageRatio
              ? {
                  aspectRatio: `${imageRatio}`,
                  maxWidth: `calc(min(70vh, 52rem) * ${imageRatio})`,
                }
              : undefined
          }
        >
          <Image
            src={activeImage}
            alt={product.title}
            fill
            priority
            className={styles.mainImage}
            sizes="(max-width: 950px) 100vw, 60vw"
            onLoad={(event) => {
              const img = event.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setImageRatio(img.naturalWidth / img.naturalHeight);
              }
            }}
          />
        </div>

        {product.product_images.length > 1 ? (
          <div className={styles.thumbs}>
            {product.product_images.map((image) => (
              <button
                key={image.id}
                type="button"
                className={`${styles.thumb} ${activeImage === image.image_url ? styles.thumbActive : ""}`}
                onClick={() => {
                  if (image.image_url !== activeImage) {
                    setImageRatio(null);
                    setActiveImage(image.image_url);
                  }
                }}
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

        <div className={styles.buyActions}>
          <FavouriteButton
            productId={product.id}
            productTitle={product.title}
            size="detail"
            className={styles.favouriteButton}
          />
          {purchasesAllowed ? (
            <>
              <button className={`button-solid ${styles.buyButton}`} type="button" onClick={handleAddToCart}>
                Add to cart
              </button>
              <button
                className={`button-outline ${styles.buyButton}`}
                type="button"
                onClick={handleBuyNow}
                disabled={isCheckingOut}
              >
                {isCheckingOut
                  ? "Redirecting..."
                  : itemCount > 0
                    ? "Buy now (includes cart)"
                    : "Buy now"}
              </button>
            </>
          ) : null}
        </div>

        {!purchasesAllowed ? (
          <p className={styles.purchaseNotice}>
            {PURCHASES_DISABLED_MESSAGE}{" "}
            <Link href="/contact">Contact</Link>
          </p>
        ) : null}

        {purchasesAllowed && itemCount > 0 ? (
          <p className={styles.cartFeedback}>
            {itemCount} item{itemCount === 1 ? "" : "s"} already in your cart.{" "}
            <Link href="/cart">View cart</Link>
          </p>
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}

        {product.description ? <p className={styles.description}>{product.description}</p> : null}
        {shareButtons ? <div className={styles.shareRow}>{shareButtons}</div> : null}
        <p className={styles.meta}>Made to order · Archival quality · Free shipping within Australia</p>
      </aside>
    </section>
  );
}
