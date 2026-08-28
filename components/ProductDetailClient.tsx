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
} from "./FramedPreview";
import { usePurchasesAllowed } from "./PurchasesAccessProvider";
import { adminClientFetch, adminClientFetchError } from "../lib/admin-client-fetch";
import { readCart } from "../lib/cart";
import { providerFromVariant } from "../lib/fulfilment";
import { isWallSource } from "../lib/exhibition-links";
import { readOrderItemEditParams, buildOrderItemEditQuery } from "../lib/order-item-edit-params";
import { PlausibleEvents, trackEvent } from "../lib/plausible";
import {
  classIdFromPaperPresentation,
  findVariantForOfferCombo,
  isFramedOfferClass,
  offerPresentationLabel,
  offerPresentationSummary,
  OFFER_CLASS_PROVIDER,
  OFFER_CLASSES,
  OFFER_PAPER_DETAILS,
  OFFER_PAPER_IDS,
  OFFER_PAPER_LABEL,
  OFFER_PAPER_PRESENTATIONS,
  OFFER_PAPER_SUMMARY,
  OFFER_SIZE_HINT,
  OFFER_SIZE_LABEL,
  OFFER_SIZES,
  paperPresentationFromClassId,
  parseOfferAxesFromVariant,
  type OfferClassId,
  type OfferPaperId,
  type OfferPresentationId,
  type OfferSizeId,
} from "../lib/print-offer";
import { SHOW_CUSTOM_PRINT_PAGE } from "../lib/print-custom";
import { FRAME_NOTE_ACRYLIC, OFFER_FRAMED_SAMPLE_IMAGE } from "../lib/print-frame-styles";
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

const POSTERFACTORY_FRAME_COLOURS: { id: FrameColourId; label: string }[] = [
  { id: "black", label: "Black" },
  { id: "white", label: "White" },
  { id: "timber", label: "Timber" },
];

const formatShopDimensions = (widthMm: number, heightMm: number): string => {
  const wIn = Math.round(mmToInches(widthMm) * 10) / 10;
  const hIn = Math.round(mmToInches(heightMm) * 10) / 10;
  return `${Math.round(widthMm / 10)} × ${Math.round(heightMm / 10)} cm · ${wIn} × ${hIn} in`;
};

/** Price difference against the current selection, e.g. "+$25" or "−$8.50". */
const formatPriceDelta = (cents: number): string => {
  const magnitude = Math.abs(cents);
  const body = magnitude % 100 === 0 ? `$${magnitude / 100}` : formatAUD(magnitude);
  return `${cents > 0 ? "+" : "−"}${body}`;
};

const LARGEST_OFFER_LONG_EDGE_MM = Math.max(...OFFER_SIZES.map((size) => size.longEdgeMm));

export function ProductDetailClient({ product, shareButtons, isAdmin = false }: ProductDetailClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const primaryImage = product.product_images[0]?.image_url ?? "";
  const variants = product.product_variants;

  const offerVariants = useMemo(() => {
    return variants.filter((variant) => {
      const axes = parseOfferAxesFromVariant(variant);
      return axes !== null && (OFFER_CLASSES as readonly string[]).includes(axes.classId);
    });
  }, [variants]);

  const useOfferChooser = offerVariants.length > 0;

  const preselectVariantId = searchParams.get("variant");
  const preselectedAxes = useMemo(() => {
    const match = variants.find((variant) => variant.id === preselectVariantId);
    return match ? parseOfferAxesFromVariant(match) : null;
  }, [preselectVariantId, variants]);

  const defaultAxes = useMemo(() => {
    if (preselectedAxes) return preselectedAxes;
    const defaultPhoto = findVariantForOfferCombo(offerVariants, {
      sizeId: "a3",
      classId: "photographic",
    });
    if (defaultPhoto) {
      return parseOfferAxesFromVariant(defaultPhoto)!;
    }
    const defaultFineArt = findVariantForOfferCombo(offerVariants, {
      sizeId: "a3",
      classId: "fine_art",
    });
    if (defaultFineArt) {
      return parseOfferAxesFromVariant(defaultFineArt)!;
    }
    const first = offerVariants[0] ? parseOfferAxesFromVariant(offerVariants[0]) : null;
    return first ?? { sizeId: "a3" as OfferSizeId, classId: "photographic" as OfferClassId };
  }, [offerVariants, preselectedAxes]);

  const defaultPaperFinish = paperPresentationFromClassId(defaultAxes.classId);
  const [sizeId, setSizeId] = useState<OfferSizeId>(defaultAxes.sizeId);
  const [paperId, setPaperId] = useState<OfferPaperId>(defaultPaperFinish.paper);
  const [presentationId, setPresentationId] = useState<OfferPresentationId>(
    defaultPaperFinish.presentation,
  );
  const [frameColour, setFrameColour] = useState<FrameColourId>("black");

  const classId = classIdFromPaperPresentation(paperId, presentationId) ?? defaultAxes.classId;

  // Seeded from the default axes rather than variants[0], so the server-rendered
  // price already matches the size and paper shown as selected.
  const [selectedVariantId, setSelectedVariantId] = useState<string>(() => {
    const preselected = variants.find((variant) => variant.id === preselectVariantId);
    if (preselected) return preselected.id;
    const resolved = useOfferChooser ? findVariantForOfferCombo(offerVariants, defaultAxes) : null;
    return resolved?.id ?? variants[0]?.id ?? "";
  });
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
      classId,
    });
    if (resolved) setSelectedVariantId(resolved.id);
  }, [classId, offerVariants, sizeId, useOfferChooser]);

  useEffect(() => {
    if (!preselectVariantId) return;
    const match = variants.find((variant) => variant.id === preselectVariantId);
    if (!match) return;
    setSelectedVariantId(match.id);
    const axes = parseOfferAxesFromVariant(match);
    if (axes) {
      setSizeId(axes.sizeId);
      const paperFinish = paperPresentationFromClassId(axes.classId);
      setPaperId(paperFinish.paper);
      setPresentationId(paperFinish.presentation);
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

  const availableClassIds = useMemo(() => {
    const ids = new Set<OfferClassId>();
    for (const variant of offerVariants) {
      const axes = parseOfferAxesFromVariant(variant);
      if (axes) ids.add(axes.classId);
    }
    return OFFER_CLASSES.filter((id) => ids.has(id));
  }, [offerVariants]);

  /** Finishes actually stocked for each paper, keyed by paper. */
  const finishesByPaper = useMemo(() => {
    const map = {} as Record<OfferPaperId, OfferPresentationId[]>;
    for (const paper of OFFER_PAPER_IDS) {
      map[paper] = OFFER_PAPER_PRESENTATIONS[paper].filter((presentation) => {
        const mapped = classIdFromPaperPresentation(paper, presentation);
        return mapped !== null && availableClassIds.includes(mapped);
      });
    }
    return map;
  }, [availableClassIds]);

  const availablePaperIds = useMemo(
    () => OFFER_PAPER_IDS.filter((paper) => finishesByPaper[paper].length > 0),
    [finishesByPaper],
  );

  const availablePresentations = finishesByPaper[paperId] ?? [];

  const selectPaper = (nextPaper: OfferPaperId) => {
    setPaperId(nextPaper);
    const finishes = finishesByPaper[nextPaper] ?? [];
    if (finishes.length > 0 && !finishes.includes(presentationId)) {
      setPresentationId(finishes[0]!);
    }
  };

  const priceForCombo = (combo: {
    sizeId: OfferSizeId;
    classId: OfferClassId;
  }): ProductVariant | null => findVariantForOfferCombo(offerVariants, combo);

  const priceCentsForCombo = (combo: { sizeId: OfferSizeId; classId: OfferClassId }): number | null =>
    priceForCombo(combo)?.price_aud ?? null;

  const selectedPriceCents = priceCentsForCombo({ sizeId, classId });

  /** Cost of swapping one axis while the others stay put. */
  const deltaForClass = (candidateClassId: OfferClassId | null): number | null => {
    if (!candidateClassId || selectedPriceCents === null) return null;
    const candidate = priceCentsForCombo({ sizeId, classId: candidateClassId });
    if (candidate === null) return null;
    return candidate - selectedPriceCents;
  };

  const deltaLabel = (isSelected: boolean, delta: number | null): string => {
    if (isSelected) return "Selected";
    if (delta === null) return "Unavailable";
    if (delta === 0) return "Same price";
    return formatPriceDelta(delta);
  };

  const frameColourLabel =
    POSTERFACTORY_FRAME_COLOURS.find((option) => option.id === frameColour)?.label ?? "";

  const selectedLongEdgeMm =
    OFFER_SIZES.find((size) => size.id === sizeId)?.longEdgeMm ?? LARGEST_OFFER_LONG_EDGE_MM;

  const selectedDimensionLine =
    selectedVariant?.width_mm && selectedVariant?.height_mm
      ? formatShopDimensions(selectedVariant.width_mm, selectedVariant.height_mm)
      : null;

  const selectionSummary = useOfferChooser
    ? [
        OFFER_SIZE_LABEL[sizeId],
        OFFER_PAPER_LABEL[paperId],
        offerPresentationLabel(paperId, presentationId),
        ...(isFramedOfferClass(classId) ? [`${frameColourLabel.toLowerCase()} frame`] : []),
      ].join(" · ")
    : (selectedVariant?.variant_label ?? "");

  if (!primaryImage) {
    throw new Error(`Missing product image for product: ${product.slug}`);
  }

  const cartLine = () => {
    if (!selectedVariant) return null;
    // Prefer the variant row; fall back to the selected offer class so newly
    // presented Photographic/Framed options still enforce cart rules before rebuild.
    const fulfilmentProvider =
      providerFromVariant(selectedVariant) ?? OFFER_CLASS_PROVIDER[classId] ?? null;
    return {
      variant_id: selectedVariant.id,
      product_title: product.title,
      variant_label: selectedVariant.variant_label,
      price_aud: selectedVariant.price_aud,
      slug: product.slug,
      image_url: primaryImage,
      quantity: 1 as const,
      fulfilment_provider: fulfilmentProvider,
      frame_colour: isFramedOfferClass(classId) ? frameColour : null,
    };
  };

  const handleAddToCart = () => {
    if (!purchasesAllowed) return;
    const item = cartLine();
    if (!item || !selectedVariant) return;
    setError(null);
    const result = addItem(item);
    if (!result.ok) return;
    trackEvent(PlausibleEvents.SHOP_ADD_TO_CART, {
      product: product.title,
      variant: selectedVariant.variant_label,
      price: selectedVariant.price_aud,
      ...(fromWall ? { source: "wall" } : {}),
    });
    router.push("/cart");
  };

  const startCheckout = async (checkoutItems: { variant_id: string; quantity: number; frame_colour?: string | null }[]) => {
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
    await startCheckout([
      { variant_id: item.variant_id, quantity: item.quantity, frame_colour: item.frame_colour },
    ]);
  };

  const handleBuyNow = async () => {
    if (!purchasesAllowed) return;
    const item = cartLine();
    if (!item || !selectedVariant) return;
    const result = addItem(item);
    if (!result.ok) return;
    const checkoutItems = readCart().map((row) => ({
      variant_id: row.variant_id,
      quantity: row.quantity,
      ...(row.frame_colour ? { frame_colour: row.frame_colour } : {}),
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

  const confirmStudioOrder = async (existingOrderId: string | null, quantity: number) => {
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
          quantity,
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
      const copies = quantity > 1 ? ` (${quantity} copies)` : "";
      setStudioOrderMessage(
        body?.added_to_existing
          ? `Added to studio order ${body.order_number ?? ""}${copies}.`
          : `Studio order ${body?.order_number ?? ""} created${copies}.`,
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
          frame={useOfferChooser && isFramedOfferClass(classId) ? "standard" : "none"}
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
          <div className={styles.priceRow}>
            <p className={styles.price}>
              {selectedVariant ? formatAUD(selectedVariant.price_aud) : "Price unavailable"}
            </p>
            {isEditingOrderItem ? null : (
              <FavouriteButton
                productId={product.id}
                productTitle={product.title}
                size="compact"
                className={styles.favouriteButton}
              />
            )}
          </div>
          {selectionSummary ? <p className={styles.offerSummary}>{selectionSummary}</p> : null}
        </div>

        {useOfferChooser ? (
          <div className={styles.offerChooser}>
            <fieldset className={styles.step}>
              <legend className={styles.stepLegend}>
                <span className={styles.stepNumber} aria-hidden>
                  1
                </span>
                <span className={styles.stepTitle}>Size</span>
                {SHOW_CUSTOM_PRINT_PAGE && product.product_type === "print" && !fromWall ? (
                  <Link
                    className={styles.stepAside}
                    href={
                      orderItemEdit
                        ? `/shop/${product.slug}/custom?${buildOrderItemEditQuery(orderItemEdit.orderId, orderItemEdit.itemId)}`
                        : `/shop/${product.slug}/custom`
                    }
                  >
                    Custom size
                  </Link>
                ) : null}
              </legend>
              <div className={styles.chipRow} data-columns="4">
                {availableSizeIds.map((id) => {
                  const sample = priceForCombo({ sizeId: id, classId });
                  return (
                    <label
                      key={id}
                      className={`${styles.chip} ${sizeId === id ? styles.chipActive : ""} ${
                        sample ? "" : styles.chipDisabled
                      }`}
                    >
                      <input
                        type="radio"
                        name="offer-size"
                        className={styles.chipInput}
                        checked={sizeId === id}
                        disabled={!sample}
                        onChange={() => setSizeId(id)}
                      />
                      <span className={styles.chipTitle}>{OFFER_SIZE_LABEL[id]}</span>
                      <span className={styles.chipMeta}>
                        {sample ? formatAUD(sample.price_aud) : "—"}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className={styles.scaleRow}>
                <span className={styles.scaleTrack} aria-hidden>
                  <span
                    className={styles.scaleFill}
                    style={{
                      width: `${Math.round((selectedLongEdgeMm / LARGEST_OFFER_LONG_EDGE_MM) * 100)}%`,
                    }}
                  />
                </span>
                <span className={styles.scaleLabel}>
                  {selectedDimensionLine ? `${selectedDimensionLine} · ` : ""}
                  {OFFER_SIZE_HINT[sizeId]}
                </span>
              </p>
            </fieldset>

            <fieldset className={styles.step}>
              <legend className={styles.stepLegend}>
                <span className={styles.stepNumber} aria-hidden>
                  2
                </span>
                <span className={styles.stepTitle}>Paper</span>
              </legend>
              <div className={styles.chipRow} data-columns="3">
                {availablePaperIds.map((id) => {
                  const finishes = finishesByPaper[id] ?? [];
                  const nearestFinish = finishes.includes(presentationId) ? presentationId : finishes[0];
                  const nearestClass = nearestFinish
                    ? classIdFromPaperPresentation(id, nearestFinish)
                    : null;
                  return (
                    <label
                      key={id}
                      className={`${styles.chip} ${paperId === id ? styles.chipActive : ""}`}
                    >
                      <input
                        type="radio"
                        name="offer-paper"
                        className={styles.chipInput}
                        checked={paperId === id}
                        onChange={() => selectPaper(id)}
                      />
                      <span className={styles.chipTitle}>{OFFER_PAPER_LABEL[id]}</span>
                      <span className={styles.chipMeta}>
                        {deltaLabel(paperId === id, deltaForClass(nearestClass))}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className={styles.stepNote}>{OFFER_PAPER_SUMMARY[paperId]}</p>
              <details className={styles.offerDetails}>
                <summary>About this paper</summary>
                <p>{OFFER_PAPER_DETAILS[paperId]}</p>
              </details>
            </fieldset>

            {availablePresentations.length > 0 ? (
              <fieldset className={styles.step}>
                <legend className={styles.stepLegend}>
                  <span className={styles.stepNumber} aria-hidden>
                    3
                  </span>
                  <span className={styles.stepTitle}>Finish</span>
                </legend>
                <div className={styles.chipRow} data-columns="3">
                  {availablePresentations.map((id) => (
                    <label
                      key={id}
                      className={`${styles.chip} ${presentationId === id ? styles.chipActive : ""}`}
                    >
                      <input
                        type="radio"
                        name="offer-finish"
                        className={styles.chipInput}
                        checked={presentationId === id}
                        onChange={() => setPresentationId(id)}
                      />
                      <span className={styles.chipTitle}>{offerPresentationLabel(paperId, id)}</span>
                      <span className={styles.chipMeta}>
                        {deltaLabel(
                          presentationId === id,
                          deltaForClass(classIdFromPaperPresentation(paperId, id)),
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                <p className={styles.stepNote}>{offerPresentationSummary(paperId, presentationId)}</p>
              </fieldset>
            ) : null}

            {isFramedOfferClass(classId) ? (
              <fieldset className={styles.step}>
                <legend className={styles.stepLegend}>
                  <span className={styles.stepNumber} aria-hidden>
                    4
                  </span>
                  <span className={styles.stepTitle}>Frame colour</span>
                </legend>
                <div className={styles.chipRow} data-columns="3">
                  {POSTERFACTORY_FRAME_COLOURS.map((option) => (
                    <label
                      key={option.id}
                      className={`${styles.chip} ${frameColour === option.id ? styles.chipActive : ""}`}
                    >
                      <input
                        type="radio"
                        name="frame-colour"
                        className={styles.chipInput}
                        checked={frameColour === option.id}
                        onChange={() => setFrameColour(option.id)}
                      />
                      <span
                        className={styles.frameColourSwatch}
                        data-frame-colour={option.id}
                        aria-hidden
                      />
                      <span className={styles.chipTitle}>{option.label}</span>
                    </label>
                  ))}
                </div>
                <div className={styles.frameNoteRow}>
                  <img
                    src={OFFER_FRAMED_SAMPLE_IMAGE}
                    alt="The three frame mouldings: black, white and timber"
                    width={64}
                    height={64}
                    className={styles.frameSampleImage}
                    loading="lazy"
                    decoding="async"
                  />
                  <p className={styles.stepNote}>{FRAME_NOTE_ACRYLIC}</p>
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
                          ? `Buy now (${itemCount + 1} prints)`
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
                {itemCount === 1 ? "1 print" : `${itemCount} prints`} already in your cart.{" "}
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
                    Admin only · No payment, no edition number. Queues a lab TIFF for fulfilment.
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
        askQuantity
        busy={isStudioOrdering}
        onCancel={() => { if (!isStudioOrdering) setStudioOrderDialogOpen(false); }}
        onConfirm={(orderId, quantity) => void confirmStudioOrder(orderId, quantity)}
      />
    </section>
  );
}
