"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";

import { useCart } from "./CartProvider";
import { FavouriteButton } from "./FavouriteButton";
import { StudioOrderDestinationDialog, loadOpenStudioOrders } from "./StudioOrderDestinationDialog";
import {
  type FrameColourId,
  FramedPreview,
  mapOfferPresentationToFrame,
} from "./FramedPreview";
import { usePurchasesAllowed } from "./PurchasesAccessProvider";
import { adminClientFetch, adminClientFetchError } from "../lib/admin-client-fetch";
import { readCart } from "../lib/cart";
import { isWallSource } from "../lib/exhibition-links";
import { readOrderItemEditParams, buildOrderItemEditQuery } from "../lib/order-item-edit-params";
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
import {
  FRAME_NOTE_PERSPEX,
  OFFER_FRAMED_FRAME,
  OFFER_FRAMED_SAMPLE_IMAGE,
} from "../lib/print-frame-styles";
import { mmToInches } from "../lib/print-size";
import { PURCHASES_DISABLED_MESSAGE } from "../lib/purchases-access";
import type { ProductVariant, ProductWithVariantsAndImages } from "../lib/supabase/types";
import type { OpenStudioOrder } from "../lib/studio-orders";
import { formatAUD } from "../lib/utils/currency";
import styles from "./ProductDetailClient.module.css";

type ProductDetailClientProps = {
  product: ProductWithVariantsAndImages;
  shareButtons?: ReactNode;
  isAdmin?: boolean;
};

const FINISH_OPTIONS: OfferFinishId[] = ["archival_matte", "rth_canvas"];
const PRESENTATION_OPTIONS: OfferPresentationId[] = ["unframed", "framed"];
const FRAME_COLOUR_OPTIONS: { id: FrameColourId; label: string }[] = [
  { id: "black", label: "Black" },
  { id: "silver", label: "Silver" },
  { id: "teak", label: "Teak" },
  { id: "gold", label: "Gold" },
  { id: "white", label: "White" },
];

const formatShopDimensions = (widthMm: number, heightMm: number): string => {
  const wIn = Math.round(mmToInches(widthMm) * 10) / 10;
  const hIn = Math.round(mmToInches(heightMm) * 10) / 10;
  return `${Math.round(widthMm)} × ${Math.round(heightMm)} mm · ${wIn} × ${hIn} in`;
};

export function ProductDetailClient({ product, shareButtons, isAdmin = false }: ProductDetailClientProps) {
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
  const [frameColour, setFrameColour] = useState<FrameColourId>("black");

  const initialVariantId =
    variants.find((variant) => variant.id === preselectVariantId)?.id ?? variants[0]?.id ?? "";
  const [selectedVariantId, setSelectedVariantId] = useState(initialVariantId);
  const [activeImage, setActiveImage] = useState(primaryImage);
  const [imageRatio, setImageRatio] = useState<number | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isStudioOrdering, setIsStudioOrdering] = useState(false);
  const [studioOrderDialogOpen, setStudioOrderDialogOpen] = useState(false);
  const [openStudioOrders, setOpenStudioOrders] = useState<OpenStudioOrder[]>([]);
  const [studioOrderMessage, setStudioOrderMessage] = useState<string | null>(null);
  const [isSavingOrderItem, setIsSavingOrderItem] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addItem, itemCount } = useCart();
  const purchasesAllowed = usePurchasesAllowed();
  const fromWall = isWallSource(searchParams.get("src"));
  const orderItemEdit = isAdmin ? readOrderItemEditParams(searchParams) : null;
  const isEditingOrderItem = Boolean(orderItemEdit);

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

  useEffect(() => {
    trackEvent(PlausibleEvents.SHOP_VIEW_PRODUCT, {
      product: product.title,
      variant: selectedVariant?.variant_label ?? "default",
      ...(fromWall ? { source: "wall" } : {}),
    });
    // Once per product page open (wall vs normal).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id, fromWall]);

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
      ...(fromWall ? { source: "wall" } : {}),
    });
    router.push("/cart");
  };

  const startCheckout = async (checkoutItems: { variant_id: string; quantity: number }[]) => {
    if (!selectedVariant) return;

    try {
      setIsCheckingOut(true);
      setError(null);

      trackEvent(PlausibleEvents.SHOP_CHECKOUT_START, {
        product: product.title,
        variant: selectedVariant.variant_label,
        price: selectedVariant.price_aud,
        items: checkoutItems.length,
        ...(fromWall ? { source: "wall" } : {}),
      });

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: checkoutItems,
          ...(fromWall ? { source: "wall" } : {}),
        }),
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Checkout request failed.");
      }

      window.location.href = data.url;
    } catch (checkoutError) {
      console.error(checkoutError);
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Unable to start checkout. Please try again.",
      );
      setIsCheckingOut(false);
    }
  };

  const handleBuyThisPrint = async () => {
    if (!purchasesAllowed) return;
    const item = cartLine();
    if (!item || !selectedVariant) return;
    await startCheckout([{ variant_id: item.variant_id, quantity: item.quantity }]);
  };

  const handleBuyNow = async () => {
    if (!purchasesAllowed) return;
    const item = cartLine();
    if (!item || !selectedVariant) return;
    addItem(item);
    const checkoutItems = readCart().map((row) => ({
      variant_id: row.variant_id,
      quantity: row.quantity,
    }));
    await startCheckout(checkoutItems);
  };

  const handleStudioOrder = async () => {
    if (!isAdmin || !selectedVariant || product.product_type !== "print") return;

    try {
      setIsStudioOrdering(true);
      setError(null);
      setStudioOrderMessage(null);
      const orders = await loadOpenStudioOrders();
      setOpenStudioOrders(orders);
      setStudioOrderDialogOpen(true);
    } catch (studioError) {
      setError(adminClientFetchError(studioError));
    } finally {
      setIsStudioOrdering(false);
    }
  };

  const confirmStudioOrder = async (existingOrderId: string | null) => {
    if (!selectedVariant) return;

    try {
      setIsStudioOrdering(true);
      setError(null);

      const response = await adminClientFetch("/api/admin/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "studio",
          variant_id: selectedVariant.id,
          quantity: 1,
          ...(existingOrderId ? { existing_order_id: existingOrderId } : {}),
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string; order_number?: string; added_to_existing?: boolean }
        | null;

      if (response.status === 401) {
        setError("Admin session expired. Sign in at /admin/login, then try again.");
        return;
      }

      if (!response.ok) {
        setError(body?.error ?? "Could not create studio order.");
        return;
      }

      setStudioOrderDialogOpen(false);
      setStudioOrderMessage(
        body?.added_to_existing
          ? `Added to studio order ${body.order_number ?? ""}.`
          : `Studio order ${body?.order_number ?? ""} created.`,
      );
    } catch (studioError) {
      setError(adminClientFetchError(studioError));
    } finally {
      setIsStudioOrdering(false);
    }
  };

  const saveEditedOrderItem = async () => {
    if (!orderItemEdit || !selectedVariant) return;
    setIsSavingOrderItem(true);
    setError(null);
    try {
      const response = await adminClientFetch(
        `/api/admin/orders/${orderItemEdit.orderId}/items/${orderItemEdit.itemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variant_id: selectedVariant.id }),
        },
      );
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 401) {
        setError("Admin session expired. Sign in at /admin/login, then try again.");
        return;
      }
      if (!response.ok) {
        setError(body?.error ?? "Could not update this order item.");
        return;
      }
      router.push(`/admin/orders/${orderItemEdit.orderId}`);
    } catch (saveError) {
      setError(adminClientFetchError(saveError));
    } finally {
      setIsSavingOrderItem(false);
    }
  };

  return (
    <section className={`section container ${styles.wrap}`}>
      <div className={styles.gallery}>
        <FramedPreview
          frame={
            useOfferChooser && finishId === "archival_matte"
              ? mapOfferPresentationToFrame(presentationId)
              : "none"
          }
          longEdgeMm={OFFER_SIZES.find((size) => size.id === sizeId)?.longEdgeMm ?? 594}
          frameColour={frameColour}
          className={styles.mainImageWrap}
          style={
            imageRatio
              ? {
                  aspectRatio: `${imageRatio}`,
                  maxWidth: `min(100%, calc(min(70vh, 52rem) * ${imageRatio}))`,
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
        </FramedPreview>

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
        {fromWall ? (
          <div className={styles.wallBanner}>
            {purchasesAllowed ? (
              <>
                <p>
                  You&apos;re viewing the print on the wall. Choose size and finish, then buy this print — or ask at the
                  desk if you prefer to pay in person.
                </p>
                <p>
                  Exhibition pickup is available at checkout. Prefer staff help? Ask at the desk.
                </p>
              </>
            ) : (
              <>
                <p>
                  You&apos;re viewing the print on the wall. Favourite it on your phone, then ask at the desk to purchase
                  with card or cash.
                </p>
                <p>
                  Online checkout is temporarily closed.{" "}
                  <Link href="/contact">Contact</Link> for enquiries after your visit.
                </p>
              </>
            )}
          </div>
        ) : null}
        {product.location_tag ? <p className="eyebrow">{product.location_tag}</p> : null}
        <h1 className={styles.title}>{product.title}</h1>
        {product.description ? <p className={styles.description}>{product.description}</p> : null}
        {maxEditionSize ? <p className={styles.edition}>Edition of {maxEditionSize}</p> : null}

        <div className={styles.priceSticky}>
          <p className={styles.price}>
            {selectedVariant ? formatAUD(selectedVariant.price_aud) : "Price unavailable"}
          </p>
          {useOfferChooser && selectedVariant ? (
            <p className={styles.offerSummary}>{selectedVariant.variant_label}</p>
          ) : null}
        </div>

        {useOfferChooser ? (
          <div className={styles.offerChooser}>
            <fieldset className={styles.offerFieldset}>
              <legend className={styles.sizeLegend}>
                <span>Size</span>
                {SHOW_CUSTOM_PRINT_PAGE && product.product_type === "print" && !fromWall ? (
                  <Link
                    className={styles.sizeCustomLink}
                    href={
                      orderItemEdit
                        ? `/shop/${product.slug}/custom?${buildOrderItemEditQuery(orderItemEdit.orderId, orderItemEdit.itemId)}`
                        : `/shop/${product.slug}/custom`
                    }
                  >
                    Custom
                  </Link>
                ) : null}
              </legend>
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
                <p className={styles.frameNote}>{FRAME_NOTE_PERSPEX}</p>
                <div className={styles.offerOptions}>
                  {PRESENTATION_OPTIONS.map((id) => {
                    const sample = priceForCombo({
                      sizeId,
                      finishId: "archival_matte",
                      presentationId: id,
                    });
                    const isFramedOption = id === "framed";
                    return (
                      <label
                        key={id}
                        className={`${styles.offerOption} ${isFramedOption ? styles.offerOptionWithSample : ""} ${
                          presentationId === id ? styles.offerOptionActive : ""
                        } ${!sample ? styles.offerOptionDisabled : ""}`}
                      >
                        <input
                          type="radio"
                          name="offer-presentation"
                          checked={presentationId === id}
                          disabled={!sample}
                          onChange={() => setPresentationId(id)}
                        />
                        {isFramedOption ? (
                          <span className={styles.offerOptionSample}>
                            <img
                              src={OFFER_FRAMED_SAMPLE_IMAGE}
                              alt={`${OFFER_FRAMED_FRAME.label} moulding sample`}
                              width={96}
                              height={96}
                              className={styles.offerOptionSampleImage}
                              loading="lazy"
                              decoding="async"
                            />
                          </span>
                        ) : null}
                        <span className={styles.offerOptionCopy}>
                          <span className={styles.offerOptionTitle}>{OFFER_PRESENTATION_LABEL[id]}</span>
                          {isFramedOption ? (
                            <span className={styles.offerOptionMeta}>{OFFER_FRAMED_FRAME.summary}</span>
                          ) : (
                            <span className={styles.offerOptionMeta}>Print only — no moulding</span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}
            {finishId === "archival_matte" && presentationId === "framed" ? (
              <fieldset className={styles.offerFieldset}>
                <legend>Frame colour</legend>
                <div className={styles.frameColourOptions}>
                  {FRAME_COLOUR_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className={`${styles.frameColourOption} ${
                        frameColour === option.id ? styles.frameColourOptionActive : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="frame-colour"
                        checked={frameColour === option.id}
                        onChange={() => setFrameColour(option.id)}
                      />
                      <span
                        className={styles.frameColourSwatch}
                        data-frame-colour={option.id}
                        aria-hidden
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
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

        {isEditingOrderItem ? (
          <div className={styles.studioOrder}>
            <p className={styles.studioOrderHint}>
              Updating this print on the existing order. Choose size, paper, and frame, then save.
            </p>
            <div className={`${styles.buyActions} ${styles.buyActionsWall}`}>
              <button
                className={`button-solid ${styles.buyButton}`}
                type="button"
                onClick={() => void saveEditedOrderItem()}
                disabled={!selectedVariant || isSavingOrderItem}
              >
                {isSavingOrderItem ? "Saving…" : "Save to order"}
              </button>
              {orderItemEdit ? (
                <Link className={`button-outline ${styles.buyButton}`} href={`/admin/orders/${orderItemEdit.orderId}`}>
                  Cancel
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className={`${styles.buyActions} ${fromWall ? styles.buyActionsWall : ""}`}>
              <FavouriteButton
                productId={product.id}
                productTitle={product.title}
                size="detail"
                className={styles.favouriteButton}
              />
              {purchasesAllowed ? (
                fromWall ? (
                  <button
                    className={`button-solid ${styles.buyButton}`}
                    type="button"
                    onClick={handleBuyThisPrint}
                    disabled={isCheckingOut}
                  >
                    {isCheckingOut ? "Redirecting..." : "Buy this print"}
                  </button>
                ) : (
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
                )
              ) : null}
            </div>

            {!purchasesAllowed && !fromWall ? (
              <p className={styles.purchaseNotice}>
                {PURCHASES_DISABLED_MESSAGE}{" "}
                <Link href="/contact">Contact</Link>
              </p>
            ) : null}

            {purchasesAllowed && !fromWall && itemCount > 0 ? (
              <p className={styles.cartFeedback}>
                {itemCount} item{itemCount === 1 ? "" : "s"} already in your cart.{" "}
                <Link href="/cart">View cart</Link>
              </p>
            ) : null}

            {isAdmin && product.product_type === "print" ? (
              <div className={styles.studioOrder}>
                <button
                  className={`button-outline ${styles.buyButton}`}
                  type="button"
                  onClick={() => void handleStudioOrder()}
                  disabled={!selectedVariant || isStudioOrdering || studioOrderDialogOpen}
                >
                  {isStudioOrdering ? "Creating studio order…" : "Order for studio"}
                </button>
                {studioOrderMessage ? (
                  <p className={styles.studioOrderSuccess}>
                    {studioOrderMessage}{" "}
                    <Link href="/admin/fulfilment">Open fulfilment</Link> for specs and the print file.
                  </p>
                ) : (
                  <p className={styles.studioOrderHint}>
                    Admin only · No payment, no edition number. Queues a lab TIFF for Pixel Perfect.
                  </p>
                )}
              </div>
            ) : null}
          </>
        )}

        {error ? <p className={styles.error}>{error}</p> : null}

        {shareButtons ? <div className={styles.shareRow}>{shareButtons}</div> : null}
        <p className={styles.meta}>Made to order · Archival quality · Free shipping within Australia</p>
      </aside>
      <StudioOrderDestinationDialog
        open={studioOrderDialogOpen}
        title="Order for studio"
        description={`No payment and no edition number. Add "${selectedVariant?.variant_label ?? "this print"}" to an open studio order, or start a new one.`}
        orders={openStudioOrders}
        confirmLabel="Create"
        busy={isStudioOrdering}
        onCancel={() => { if (!isStudioOrdering) setStudioOrderDialogOpen(false); }}
        onConfirm={(orderId) => void confirmStudioOrder(orderId)}
      />
    </section>
  );
}
