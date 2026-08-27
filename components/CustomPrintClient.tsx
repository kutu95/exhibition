"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useCart } from "./CartProvider";
import { type FrameColourId, FramedPreview } from "./FramedPreview";
import { FavouriteButton } from "./FavouriteButton";
import { usePurchasesAllowed } from "./PurchasesAccessProvider";
import { StudioOrderDestinationDialog, loadOpenStudioOrders } from "./StudioOrderDestinationDialog";
import { adminClientFetch, adminClientFetchError } from "../lib/admin-client-fetch";
import { readCart } from "../lib/cart";
import { buildOrderItemEditQuery } from "../lib/order-item-edit-params";
import {
  CUSTOM_ISO_LONG_EDGE_SNAPS_MM,
  CUSTOM_LONG_EDGE_DEFAULT_MM,
  CUSTOM_LONG_EDGE_MIN_MM,
  maxCustomLongEdgeMm,
} from "../lib/print-custom";
import {
  availableCustomPapers,
  availableCustomPresentations,
  priceCustomOffer,
  type CustomOfferRates,
} from "../lib/print-custom-offer";
import { FRAME_NOTE_ACRYLIC, OFFER_FRAMED_SAMPLE_IMAGE } from "../lib/print-frame-styles";
import {
  isFramedOfferClass,
  offerPresentationLabel,
  offerPresentationSummary,
  OFFER_PAPER_DETAILS,
  OFFER_PAPER_LABEL,
  OFFER_PAPER_SUMMARY,
  type OfferPaperId,
  type OfferPresentationId,
} from "../lib/print-offer";
import { mmToInches } from "../lib/print-size";
import { PURCHASES_DISABLED_MESSAGE } from "../lib/purchases-access";
import type { OpenStudioOrder } from "../lib/studio-orders";
import { formatAUD } from "../lib/utils/currency";
import styles from "./CustomPrintClient.module.css";

type CustomPrintClientProps = {
  product: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    location_tag: string | null;
    image_url: string;
  };
  pixelWidth: number;
  pixelHeight: number;
  editionSize: number | null;
  rates: CustomOfferRates;
  /** When true (admin session cookie), show studio order and prepare/download TIFF. */
  isAdmin?: boolean;
  editOrderId?: string | null;
  editItemId?: string | null;
};

/**
 * Same three mouldings as the fixed sizes. Pixel Perfect offers more colours on
 * custom work, but keeping the two pages identical avoids a shopper choosing a
 * colour on one page that the other cannot supply.
 */
const FRAME_COLOUR_OPTIONS: { id: FrameColourId; label: string }[] = [
  { id: "black", label: "Black" },
  { id: "white", label: "White" },
  { id: "timber", label: "Timber" },
];

const formatShopDimensions = (widthMm: number, heightMm: number): string => {
  const wIn = Math.round(mmToInches(widthMm) * 10) / 10;
  const hIn = Math.round(mmToInches(heightMm) * 10) / 10;
  return `${Math.round(widthMm / 10)} × ${Math.round(heightMm / 10)} cm · ${wIn} × ${hIn} in`;
};

const formatPriceDelta = (cents: number): string => {
  const magnitude = Math.abs(cents);
  const body = magnitude % 100 === 0 ? `$${magnitude / 100}` : formatAUD(magnitude);
  return `${cents > 0 ? "+" : "−"}${body}`;
};

export function CustomPrintClient({
  product,
  pixelWidth,
  pixelHeight,
  editionSize,
  rates,
  isAdmin = false,
  editOrderId = null,
  editItemId = null,
}: CustomPrintClientProps) {
  const router = useRouter();
  const { addItem, itemCount } = useCart();
  const purchasesAllowed = usePurchasesAllowed();
  const isEditingOrderItem = Boolean(isAdmin && editOrderId && editItemId);

  const maxLongEdgeMm = useMemo(
    () => maxCustomLongEdgeMm(pixelWidth, pixelHeight),
    [pixelHeight, pixelWidth],
  );

  const [longEdgeMm, setLongEdgeMm] = useState(
    Math.min(CUSTOM_LONG_EDGE_DEFAULT_MM, maxLongEdgeMm),
  );
  const [longEdgeDraft, setLongEdgeDraft] = useState(
    String(Math.min(CUSTOM_LONG_EDGE_DEFAULT_MM, maxLongEdgeMm)),
  );
  const [paperId, setPaperId] = useState<OfferPaperId>("tier1");
  const [presentationId, setPresentationId] = useState<OfferPresentationId>("print");
  const [frameColour, setFrameColour] = useState<FrameColourId>("black");
  const [busy, setBusy] = useState<"cart" | "buy" | "print" | "studio" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studioOrderDialogOpen, setStudioOrderDialogOpen] = useState(false);
  const [openStudioOrders, setOpenStudioOrders] = useState<OpenStudioOrder[]>([]);
  const [studioOrderMessage, setStudioOrderMessage] = useState<string | null>(null);

  const commitLongEdgeMm = (next: number) => {
    const clamped = Math.min(maxLongEdgeMm, Math.max(CUSTOM_LONG_EDGE_MIN_MM, Math.round(next)));
    setLongEdgeMm(clamped);
    setLongEdgeDraft(String(clamped));
  };

  const quoteFor = useCallback(
    (args: { longEdgeMm?: number; paper?: OfferPaperId; presentation?: OfferPresentationId }) =>
      priceCustomOffer({
        longEdgeMm: args.longEdgeMm ?? longEdgeMm,
        paper: args.paper ?? paperId,
        presentation: args.presentation ?? presentationId,
        pixelWidth,
        pixelHeight,
        rates,
      }),
    [longEdgeMm, paperId, pixelHeight, pixelWidth, presentationId, rates],
  );

  const quote = useMemo(() => quoteFor({}), [quoteFor]);

  const availablePapers = useMemo(
    () => availableCustomPapers({ longEdgeMm, pixelWidth, pixelHeight, rates }),
    [longEdgeMm, pixelHeight, pixelWidth, rates],
  );

  const availablePresentations = useMemo(
    () =>
      availableCustomPresentations({
        longEdgeMm,
        paper: paperId,
        pixelWidth,
        pixelHeight,
        rates,
      }),
    [longEdgeMm, paperId, pixelHeight, pixelWidth, rates],
  );

  // Growing the print past the widest moulding band drops framing, which would
  // otherwise leave the buyer on an unpriceable selection with no visible cause.
  useEffect(() => {
    if (availablePresentations.length === 0) return;
    if (!availablePresentations.includes(presentationId)) {
      setPresentationId(availablePresentations[0]!);
    }
  }, [availablePresentations, presentationId]);

  const selectPaper = (nextPaper: OfferPaperId) => {
    setPaperId(nextPaper);
    const finishes = availableCustomPresentations({
      longEdgeMm,
      paper: nextPaper,
      pixelWidth,
      pixelHeight,
      rates,
    });
    if (finishes.length > 0 && !finishes.includes(presentationId)) {
      setPresentationId(finishes[0]!);
    }
  };

  const isFramed = quote ? isFramedOfferClass(quote.classId) : false;

  /** Cost of swapping one axis while the others stay put. */
  const deltaLabel = (
    isSelected: boolean,
    candidate: { paper?: OfferPaperId; presentation?: OfferPresentationId },
  ): string => {
    if (isSelected) return "Selected";
    if (!quote) return "Unavailable";
    const candidateQuote = quoteFor(candidate);
    if (!candidateQuote) return "Unavailable";
    const delta = candidateQuote.retailCents - quote.retailCents;
    if (delta === 0) return "Same price";
    return formatPriceDelta(delta);
  };

  const frameColourLabel =
    FRAME_COLOUR_OPTIONS.find((option) => option.id === frameColour)?.label ?? "";

  const matchingSnap = CUSTOM_ISO_LONG_EDGE_SNAPS_MM.find((snap) => snap.mm === longEdgeMm);

  const selectionSummary = quote
    ? [
        `Custom ${Math.round(quote.widthMm / 10)} × ${Math.round(quote.heightMm / 10)} cm`,
        OFFER_PAPER_LABEL[paperId],
        offerPresentationLabel(paperId, presentationId),
        ...(isFramed ? [`${frameColourLabel.toLowerCase()} frame`] : []),
      ].join(" · ")
    : null;

  const createVariant = async () => {
    const response = await fetch("/api/shop/custom-print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: product.id,
        long_edge_mm: longEdgeMm,
        paper: paperId,
        presentation: presentationId,
        pixel_width: pixelWidth,
        pixel_height: pixelHeight,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      variant_id?: string;
      variant_label?: string;
      price_aud?: number;
      fulfilment_provider?: "posterfactory" | "pixelperfect" | null;
    } | null;
    if (!response.ok || !body?.variant_id || body.price_aud === undefined || !body.variant_label) {
      throw new Error(body?.error ?? "Could not create this custom print.");
    }
    return body as {
      variant_id: string;
      variant_label: string;
      price_aud: number;
      fulfilment_provider?: "posterfactory" | "pixelperfect" | null;
    };
  };

  const cartLineFor = (created: {
    variant_id: string;
    variant_label: string;
    price_aud: number;
    fulfilment_provider?: "posterfactory" | "pixelperfect" | null;
  }) => ({
    variant_id: created.variant_id,
    product_title: product.title,
    variant_label: created.variant_label,
    price_aud: created.price_aud,
    slug: product.slug,
    image_url: product.image_url,
    quantity: 1 as const,
    fulfilment_provider: created.fulfilment_provider ?? "pixelperfect",
    frame_colour: isFramed ? frameColour : null,
  });

  const handleAddToCart = async () => {
    if (!purchasesAllowed || !quote) return;
    setBusy("cart");
    setError(null);
    try {
      const created = await createVariant();
      const result = addItem(cartLineFor(created));
      if (!result.ok) return;
      router.push("/cart");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to cart.");
    } finally {
      setBusy(null);
    }
  };

  const handleBuyNow = async () => {
    if (!purchasesAllowed || !quote) return;
    setBusy("buy");
    setError(null);
    try {
      const created = await createVariant();
      const result = addItem(cartLineFor(created));
      if (!result.ok) {
        setBusy(null);
        return;
      }
      const checkoutItems = readCart().map((row) => ({
        variant_id: row.variant_id,
        quantity: row.quantity,
        ...(row.frame_colour ? { frame_colour: row.frame_colour } : {}),
      }));
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: checkoutItems }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Checkout failed.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setBusy(null);
    }
  };

  const handlePreparePrintDownload = async () => {
    setBusy("print");
    setError(null);
    try {
      const response = await fetch(`/api/admin/products/${product.id}/prepare-custom-print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          long_edge_mm: longEdgeMm,
          pixel_width: pixelWidth,
          pixel_height: pixelHeight,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        download_path?: string;
      } | null;
      if (!response.ok || !body?.download_path) {
        throw new Error(body?.error ?? "Failed to prepare print file.");
      }
      window.location.href = body.download_path;
      setBusy(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to prepare print file.");
      setBusy(null);
    }
  };

  const handleStudioOrder = async () => {
    if (!isAdmin || !quote) return;
    setBusy("studio");
    setError(null);
    setStudioOrderMessage(null);
    try {
      const orders = await loadOpenStudioOrders();
      setOpenStudioOrders(orders);
      setStudioOrderDialogOpen(true);
    } catch (studioError) {
      setError(adminClientFetchError(studioError));
    } finally {
      setBusy(null);
    }
  };

  const confirmStudioOrder = async (existingOrderId: string | null) => {
    if (!quote) return;
    setBusy("studio");
    setError(null);
    try {
      const created = await createVariant();
      const response = await adminClientFetch("/api/admin/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "studio",
          variant_id: created.variant_id,
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
      setBusy(null);
    }
  };

  const saveEditedOrderItem = async () => {
    if (!editOrderId || !editItemId || !quote) return;
    setBusy("save");
    setError(null);
    try {
      const created = await createVariant();
      const response = await adminClientFetch(
        `/api/admin/orders/${editOrderId}/items/${editItemId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variant_id: created.variant_id }),
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
      router.push(`/admin/orders/${editOrderId}`);
    } catch (saveError) {
      setError(adminClientFetchError(saveError));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={`section container ${styles.wrap}`}>
      <p className={styles.back}>
        <Link
          href={
            isEditingOrderItem && editOrderId && editItemId
              ? `/shop/${product.slug}?${buildOrderItemEditQuery(editOrderId, editItemId)}`
              : `/shop/${product.slug}`
          }
        >
          ← Back to standard sizes
        </Link>
      </p>

      <div className={styles.layout}>
        <div className={styles.visual}>
          <FramedPreview
            frame={isFramed ? "standard" : "none"}
            frameColour={frameColour}
            longEdgeMm={longEdgeMm}
            className={styles.imageWrap}
            style={
              pixelWidth > 0 && pixelHeight > 0
                ? { aspectRatio: `${pixelWidth} / ${pixelHeight}` }
                : undefined
            }
          >
            <Image
              src={product.image_url}
              alt={product.title}
              fill
              className={styles.image}
              sizes="(max-width: 900px) 100vw, 48vw"
              priority
            />
          </FramedPreview>
        </div>

        <aside className={styles.panel}>
          {product.location_tag ? <p className="eyebrow">{product.location_tag}</p> : null}
          <h1 className={styles.title}>{product.title}</h1>
          {product.description ? <p className={styles.description}>{product.description}</p> : null}
          {editionSize ? <p className={styles.edition}>Edition of {editionSize}</p> : null}

          <div className={styles.priceSticky}>
            <div className={styles.priceRow}>
              <p className={styles.price}>
                {quote ? formatAUD(quote.retailCents) : "Price unavailable"}
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

          <div className={styles.offerChooser}>
            <fieldset className={styles.step}>
              <legend className={styles.stepLegend}>
                <span className={styles.stepNumber} aria-hidden>
                  1
                </span>
                <span className={styles.stepTitle}>Size</span>
                <Link
                  className={styles.stepAside}
                  href={
                    isEditingOrderItem && editOrderId && editItemId
                      ? `/shop/${product.slug}?${buildOrderItemEditQuery(editOrderId, editItemId)}`
                      : `/shop/${product.slug}`
                  }
                >
                  Standard sizes
                </Link>
              </legend>

              <div className={styles.chipRow} data-columns="3">
                {CUSTOM_ISO_LONG_EDGE_SNAPS_MM.map((snap) => {
                  const snapQuote =
                    snap.mm >= CUSTOM_LONG_EDGE_MIN_MM && snap.mm <= maxLongEdgeMm
                      ? quoteFor({ longEdgeMm: snap.mm })
                      : null;
                  const active = longEdgeMm === snap.mm;
                  return (
                    <label
                      key={snap.id}
                      className={`${styles.chip} ${active ? styles.chipActive : ""} ${
                        snapQuote ? "" : styles.chipDisabled
                      }`}
                    >
                      <input
                        type="radio"
                        name="custom-size-snap"
                        className={styles.chipInput}
                        checked={active}
                        disabled={!snapQuote}
                        onChange={() => commitLongEdgeMm(snap.mm)}
                      />
                      <span className={styles.chipTitle}>{snap.label}</span>
                      <span className={styles.chipMeta}>
                        {snapQuote ? formatAUD(snapQuote.retailCents) : "—"}
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className={styles.sizeSlider}>
                <label className={styles.sizeSliderLabel} htmlFor="custom-long-edge-range">
                  Or set any long edge
                </label>
                <input
                  id="custom-long-edge-range"
                  type="range"
                  min={CUSTOM_LONG_EDGE_MIN_MM}
                  max={maxLongEdgeMm}
                  step={1}
                  value={Math.min(longEdgeMm, maxLongEdgeMm)}
                  onChange={(event) => {
                    const next = Number.parseInt(event.target.value, 10);
                    setLongEdgeMm(next);
                    setLongEdgeDraft(String(next));
                  }}
                />
                <div className={styles.longEdgeRow}>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={longEdgeDraft}
                    aria-label="Long edge in millimetres"
                    onChange={(event) => {
                      const raw = event.target.value.replace(/[^\d]/g, "");
                      setLongEdgeDraft(raw);
                      if (raw === "") return;
                      const next = Number.parseInt(raw, 10);
                      if (!Number.isFinite(next)) return;
                      if (next >= CUSTOM_LONG_EDGE_MIN_MM && next <= maxLongEdgeMm) {
                        setLongEdgeMm(next);
                      }
                    }}
                    onBlur={() => {
                      const next = Number.parseInt(longEdgeDraft, 10);
                      if (Number.isFinite(next)) {
                        commitLongEdgeMm(next);
                        return;
                      }
                      setLongEdgeDraft(String(longEdgeMm));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.currentTarget.blur();
                      }
                    }}
                  />
                  <span className={styles.muted}>mm long edge</span>
                </div>
              </div>

              <p className={styles.scaleRow}>
                <span className={styles.scaleTrack} aria-hidden>
                  <span
                    className={styles.scaleFill}
                    style={{ width: `${Math.round((longEdgeMm / maxLongEdgeMm) * 100)}%` }}
                  />
                </span>
                <span className={styles.scaleLabel}>
                  {quote ? formatShopDimensions(quote.widthMm, quote.heightMm) : null}
                  {matchingSnap ? ` · same size as ${matchingSnap.label}` : ""}
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
                {availablePapers.map((id) => {
                  const finishes = availableCustomPresentations({
                    longEdgeMm,
                    paper: id,
                    pixelWidth,
                    pixelHeight,
                    rates,
                  });
                  const nearestFinish = finishes.includes(presentationId)
                    ? presentationId
                    : finishes[0];
                  return (
                    <label
                      key={id}
                      className={`${styles.chip} ${paperId === id ? styles.chipActive : ""}`}
                    >
                      <input
                        type="radio"
                        name="custom-paper"
                        className={styles.chipInput}
                        checked={paperId === id}
                        onChange={() => selectPaper(id)}
                      />
                      <span className={styles.chipTitle}>{OFFER_PAPER_LABEL[id]}</span>
                      <span className={styles.chipMeta}>
                        {deltaLabel(paperId === id, { paper: id, presentation: nearestFinish })}
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
                        name="custom-finish"
                        className={styles.chipInput}
                        checked={presentationId === id}
                        onChange={() => setPresentationId(id)}
                      />
                      <span className={styles.chipTitle}>{offerPresentationLabel(paperId, id)}</span>
                      <span className={styles.chipMeta}>
                        {deltaLabel(presentationId === id, { presentation: id })}
                      </span>
                    </label>
                  ))}
                </div>
                <p className={styles.stepNote}>
                  {offerPresentationSummary(paperId, presentationId)}
                </p>
              </fieldset>
            ) : null}

            {isFramed ? (
              <fieldset className={styles.step}>
                <legend className={styles.stepLegend}>
                  <span className={styles.stepNumber} aria-hidden>
                    4
                  </span>
                  <span className={styles.stepTitle}>Frame colour</span>
                </legend>
                <div className={styles.chipRow} data-columns="3">
                  {FRAME_COLOUR_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className={`${styles.chip} ${frameColour === option.id ? styles.chipActive : ""}`}
                    >
                      <input
                        type="radio"
                        name="custom-frame-colour"
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

          {!quote ? (
            <p className={styles.muted}>
              This combination is outside online pricing. Try a smaller size, or a finish without a
              frame.
            </p>
          ) : null}

          <div className={styles.actions}>
            {isEditingOrderItem ? (
              <div className={styles.adminPrint}>
                <p className={styles.adminHint}>
                  Updating this print on the existing order. Choose size, paper, and finish, then
                  save.
                </p>
                <button
                  className={`button-solid ${styles.button}`}
                  type="button"
                  disabled={!quote || busy !== null}
                  onClick={() => void saveEditedOrderItem()}
                >
                  {busy === "save" ? "Saving…" : "Save to order"}
                </button>
                {editOrderId ? (
                  <Link className={`button-outline ${styles.button}`} href={`/admin/orders/${editOrderId}`}>
                    Cancel
                  </Link>
                ) : null}
              </div>
            ) : (
              <>
                {purchasesAllowed ? (
                  <>
                    <button
                      className={`button-solid ${styles.button}`}
                      type="button"
                      disabled={!quote || busy !== null}
                      onClick={() => void handleAddToCart()}
                    >
                      {busy === "cart" ? "Adding…" : "Add to cart"}
                    </button>
                    <button
                      className={`button-outline ${styles.button}`}
                      type="button"
                      disabled={!quote || busy !== null}
                      onClick={() => void handleBuyNow()}
                    >
                      {busy === "buy"
                        ? "Redirecting…"
                        : itemCount > 0
                          ? `Buy now (${itemCount + 1} prints)`
                          : "Buy now"}
                    </button>
                  </>
                ) : (
                  <p className={styles.muted}>
                    {PURCHASES_DISABLED_MESSAGE} <Link href="/contact">Contact</Link>
                  </p>
                )}
                {isAdmin ? (
                  <div className={styles.adminPrint}>
                    <button
                      className={`button-outline ${styles.button}`}
                      type="button"
                      disabled={!quote || busy !== null || studioOrderDialogOpen}
                      onClick={() => void handleStudioOrder()}
                    >
                      {busy === "studio" ? "Creating studio order…" : "Order for studio"}
                    </button>
                    {studioOrderMessage ? (
                      <p className={styles.studioOrderSuccess}>
                        {studioOrderMessage}{" "}
                        <Link href="/admin/fulfilment">Open fulfilment</Link> for specs and the print file.
                      </p>
                    ) : (
                      <p className={styles.adminHint}>
                        Admin only · No payment, no edition number. Queues a lab TIFF for Pixel Perfect.
                      </p>
                    )}
                    <button
                      className={`button-outline ${styles.button}`}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void handlePreparePrintDownload()}
                    >
                      {busy === "print" ? "Preparing print TIFF…" : "Prepare & download print TIFF"}
                    </button>
                    <p className={styles.adminHint}>
                      Admin only · Lab TIFF at the size above (Adobe RGB, 300 DPI). Generation can take a few minutes.
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}
          <p className={styles.meta}>
            Made to order · Printed to your size from the master file · Free shipping within Australia
          </p>
        </aside>
      </div>
      <StudioOrderDestinationDialog
        open={studioOrderDialogOpen}
        title="Order for studio"
        description={`No payment and no edition number. Add this custom print (${selectionSummary ?? ""}) to an open studio order, or start a new one.`}
        orders={openStudioOrders}
        confirmLabel="Create"
        busy={busy === "studio"}
        onCancel={() => {
          if (busy !== "studio") setStudioOrderDialogOpen(false);
        }}
        onConfirm={(orderId) => void confirmStudioOrder(orderId)}
      />
    </section>
  );
}
