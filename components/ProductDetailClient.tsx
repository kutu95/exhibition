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
import {
  findVariantForOfferCombo,
  OFFER_FINISH_LABEL,
  OFFER_PRESENTATION_LABEL,
  OFFER_SIZE_LABEL,
  OFFER_SIZES,
  parseOfferAxesFromVariant,
  type OfferFinishId,
  type OfferPresentationId,
  type OfferSizeId,
} from "../lib/print-offer";
import { SHOW_CUSTOM_PRINT_PAGE } from "../lib/print-custom";
import { mmToInches } from "../lib/print-size";
import { PURCHASES_DISABLED_MESSAGE } from "../lib/purchases-access";
import type { ProductVariant, ProductWithVariantsAndImages } from "../lib/supabase/types";
import { formatAUD } from "../lib/utils/currency";
import styles from "./ProductDetailClient.module.css";

type ProductDetailClientProps = {
  product: ProductWithVariantsAndImages;
  shareButtons?: ReactNode;
};

const FINISH_OPTIONS: OfferFinishId[] = ["archival_matte", "rth_canvas"];
const PRESENTATION_OPTIONS: OfferPresentationId[] = ["unframed", "framed"];

const formatShopDimensions = (widthMm: number, heightMm: number): string => {
  const wIn = Math.round(mmToInches(widthMm) * 10) / 10;
  const hIn = Math.round(mmToInches(heightMm) * 10) / 10;
  return `${Math.round(widthMm)} × ${Math.round(heightMm)} mm · ${wIn} × ${hIn} in`;
};

export function ProductDetailClient({ product, shareButtons }: ProductDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const primaryImage = product.product_images[0]?.image_url ?? "";
  const variants = product.product_variants;

  const offerVariants = useMemo(() => {
    return variants.filter((variant) => parseOfferAxesFromVariant(variant) !== null);
  }, [variants]);

  const useOfferChooser = offerVariants.length > 0;

  const preselectVariantId = searchParams.get("variant");
  const preselectedAxes = useMemo(() => {
    const match = variants.find((variant) => variant.id === preselectVariantId);
    return match ? parseOfferAxesFromVariant(match) : null;
  }, [preselectVariantId, variants]);

  const defaultAxes = useMemo(() => {
    if (preselectedAxes) return preselectedAxes;
    const mediumUnframed = findVariantForOfferCombo(offerVariants, {
      sizeId: "medium",
      finishId: "archival_matte",
      presentationId: "unframed",
    });
    if (mediumUnframed) {
      return parseOfferAxesFromVariant(mediumUnframed)!;
    }
    const first = offerVariants[0] ? parseOfferAxesFromVariant(offerVariants[0]) : null;
    return first ?? { sizeId: "medium" as OfferSizeId, finishId: "archival_matte" as OfferFinishId, presentationId: "unframed" as OfferPresentationId };
  }, [offerVariants, preselectedAxes]);

  const [sizeId, setSizeId] = useState<OfferSizeId>(defaultAxes.sizeId);
  const [finishId, setFinishId] = useState<OfferFinishId>(defaultAxes.finishId);
  const [presentationId, setPresentationId] = useState<OfferPresentationId>(
    defaultAxes.finishId === "rth_canvas" ? "unframed" : defaultAxes.presentationId,
  );

  const initialVariantId =
    variants.find((variant) => variant.id === preselectVariantId)?.id ?? variants[0]?.id ?? "";
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariantId);
  const [activeImage, setActiveImage] = useState(primaryImage);
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addItem, itemCount } = useCart();
  const purchasesAllowed = usePurchasesAllowed();

  useEffect(() => {
    if (!useOfferChooser) return;
    const resolved = findVariantForOfferCombo(offerVariants, {
      sizeId,
      finishId,
      presentationId: finishId === "rth_canvas" ? "unframed" : presentationId,
    });
    if (resolved) setSelectedVariantId(resolved.id);
  }, [finishId, offerVariants, presentationId, sizeId, useOfferChooser]);

  useEffect(() => {
    if (!preselectVariantId) return;
    const match = variants.find((variant) => variant.id === preselectVariantId);
    if (!match) return;
    setSelectedVariantId(match.id);
    const axes = parseOfferAxesFromVariant(match);
    if (axes) {
      setSizeId(axes.sizeId);
      setFinishId(axes.finishId);
      setPresentationId(axes.presentationId);
    }
  }, [preselectVariantId, variants]);

  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId),
    [variants, selectedVariantId],
  );

  const maxEditionSize = useMemo(() => {
    const sizes = variants
      .map((variant) => variant.edition_size)
      .filter((size): size is number => typeof size === "number");
    return sizes.length > 0 ? Math.max(...sizes) : null;
  }, [variants]);

  const availableSizeIds = useMemo(() => {
    const ids = new Set<OfferSizeId>();
    for (const variant of offerVariants) {
      const axes = parseOfferAxesFromVariant(variant);
      if (axes) ids.add(axes.sizeId);
    }
    return OFFER_SIZES.map((s) => s.id).filter((id) => ids.has(id));
  }, [offerVariants]);

  const priceForCombo = (combo: {
    sizeId: OfferSizeId;
    finishId: OfferFinishId;
    presentationId: OfferPresentationId;
  }): ProductVariant | null => findVariantForOfferCombo(offerVariants, combo);

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

        {useOfferChooser ? (
          <div className={styles.offerChooser}>
            <fieldset className={styles.offerFieldset}>
              <legend>Size</legend>
              <div className={styles.offerOptions}>
                {availableSizeIds.map((id) => {
                  const sample = priceForCombo({
                    sizeId: id,
                    finishId,
                    presentationId: finishId === "rth_canvas" ? "unframed" : presentationId,
                  });
                  const sizeDef = OFFER_SIZES.find((size) => size.id === id);
                  const widthMm = sample?.width_mm ?? null;
                  const heightMm = sample?.height_mm ?? null;
                  const dimensionLine =
                    widthMm && heightMm && widthMm > 0 && heightMm > 0
                      ? formatShopDimensions(widthMm, heightMm)
                      : sizeDef
                        ? `Long edge ${sizeDef.longEdgeMm} mm`
                        : null;
                  return (
                    <label
                      key={id}
                      className={`${styles.offerOption} ${sizeId === id ? styles.offerOptionActive : ""} ${
                        !sample ? styles.offerOptionDisabled : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="offer-size"
                        checked={sizeId === id}
                        disabled={!sample}
                        onChange={() => setSizeId(id)}
                      />
                      <span className={styles.offerOptionCopy}>
                        <span className={styles.offerOptionTitle}>{OFFER_SIZE_LABEL[id]}</span>
                        {dimensionLine ? <span className={styles.offerOptionMeta}>{dimensionLine}</span> : null}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className={styles.offerFieldset}>
              <legend>Finish</legend>
              <div className={styles.offerOptions}>
                {FINISH_OPTIONS.map((id) => {
                  const sample = priceForCombo({
                    sizeId,
                    finishId: id,
                    presentationId: id === "rth_canvas" ? "unframed" : presentationId,
                  });
                  return (
                    <label
                      key={id}
                      className={`${styles.offerOption} ${finishId === id ? styles.offerOptionActive : ""} ${
                        !sample ? styles.offerOptionDisabled : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="offer-finish"
                        checked={finishId === id}
                        disabled={!sample}
                        onChange={() => {
                          setFinishId(id);
                          if (id === "rth_canvas") setPresentationId("unframed");
                        }}
                      />
                      <span>{OFFER_FINISH_LABEL[id]}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {finishId === "archival_matte" ? (
              <fieldset className={styles.offerFieldset}>
                <legend>Presentation</legend>
                <div className={styles.offerOptions}>
                  {PRESENTATION_OPTIONS.map((id) => {
                    const sample = priceForCombo({
                      sizeId,
                      finishId: "archival_matte",
                      presentationId: id,
                    });
                    return (
                      <label
                        key={id}
                        className={`${styles.offerOption} ${presentationId === id ? styles.offerOptionActive : ""} ${
                          !sample ? styles.offerOptionDisabled : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="offer-presentation"
                          checked={presentationId === id}
                          disabled={!sample}
                          onChange={() => setPresentationId(id)}
                        />
                        <span>{OFFER_PRESENTATION_LABEL[id]}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
          </div>
        ) : (
          <div className={styles.variants}>
            {variants.map((variant) => (
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
        )}

        <p className={styles.price}>
          {selectedVariant ? formatAUD(selectedVariant.price_aud) : "Price unavailable"}
        </p>
        {useOfferChooser && selectedVariant ? (
          <p className={styles.offerSummary}>{selectedVariant.variant_label}</p>
        ) : null}

        {SHOW_CUSTOM_PRINT_PAGE && product.product_type === "print" ? (
          <p className={styles.customLink}>
            <a href={`/shop/${product.slug}/custom`} target="_blank" rel="noreferrer">
              Custom size, media &amp; framing
            </a>
          </p>
        ) : null}

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
