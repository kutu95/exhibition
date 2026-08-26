"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useCart } from "./CartProvider";
import {
  type FrameColourId,
  FramedPreview,
  mapCustomFrameToPreview,
} from "./FramedPreview";
import { usePurchasesAllowed } from "./PurchasesAccessProvider";
import { StudioOrderDestinationDialog, loadOpenStudioOrders } from "./StudioOrderDestinationDialog";
import { adminClientFetch, adminClientFetchError } from "../lib/admin-client-fetch";
import { readCart } from "../lib/cart";
import { buildOrderItemEditQuery } from "../lib/order-item-edit-params";
import {
  computeCustomPrintPricing,
  CUSTOM_FRAME_OPTIONS,
  CUSTOM_LONG_EDGE_DEFAULT_MM,
  CUSTOM_LONG_EDGE_MIN_MM,
  CUSTOM_RTH_CANVAS_ID,
  deriveCustomSizeFromLongEdge,
  listCustomMediaOptions,
  maxCustomLongEdgeMm,
  type CustomFrameStyleId,
  type CustomMediaOption,
} from "../lib/print-custom";
import { FRAME_NOTE_PERSPEX } from "../lib/print-frame-styles";
import type { FrameRateBand, RthCanvasRateBand } from "../lib/print-frame-pricing";
import type { ManagedPaper } from "../lib/print-catalogue";
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
  mediaMarkupFactor: number;
  mediaBasePriceAud: number;
  frameMarkupFactor: number;
  frameBasePriceAud: number;
  frameRates: FrameRateBand[];
  rthCanvasRates: RthCanvasRateBand[];
  papers: ManagedPaper[];
  /** When true (admin session cookie), show studio order and prepare/download TIFF. */
  isAdmin?: boolean;
  editOrderId?: string | null;
  editItemId?: string | null;
};

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

export function CustomPrintClient({
  product,
  pixelWidth,
  pixelHeight,
  editionSize,
  mediaMarkupFactor,
  mediaBasePriceAud,
  frameMarkupFactor,
  frameBasePriceAud,
  frameRates,
  isAdmin = false,
  rthCanvasRates,
  papers,
  editOrderId = null,
  editItemId = null,
}: CustomPrintClientProps) {
  const router = useRouter();
  const { addItem, itemCount } = useCart();
  const purchasesAllowed = usePurchasesAllowed();
  const mediaOptions = useMemo(() => listCustomMediaOptions(papers), [papers]);
  const isEditingOrderItem = Boolean(isAdmin && editOrderId && editItemId);

  const defaultMedia =
    mediaOptions.find((item) => item.id === "hm-photo-rag") ?? mediaOptions[0] ?? null;

  const [longEdgeMm, setLongEdgeMm] = useState(CUSTOM_LONG_EDGE_DEFAULT_MM);
  const [longEdgeDraft, setLongEdgeDraft] = useState(String(CUSTOM_LONG_EDGE_DEFAULT_MM));
  const [mediaId, setMediaId] = useState(defaultMedia?.id ?? "");
  const [frameStyle, setFrameStyle] = useState<CustomFrameStyleId>("none");
  const [frameColour, setFrameColour] = useState<FrameColourId>("black");
  const [busy, setBusy] = useState<"cart" | "buy" | "print" | "studio" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [studioOrderDialogOpen, setStudioOrderDialogOpen] = useState(false);
  const [openStudioOrders, setOpenStudioOrders] = useState<OpenStudioOrder[]>([]);
  const [studioOrderMessage, setStudioOrderMessage] = useState<string | null>(null);

  const maxLongEdgeMm = useMemo(
    () => maxCustomLongEdgeMm(pixelWidth, pixelHeight),
    [pixelHeight, pixelWidth],
  );

  const commitLongEdgeMm = (next: number) => {
    const clamped = Math.min(maxLongEdgeMm, Math.max(CUSTOM_LONG_EDGE_MIN_MM, Math.round(next)));
    setLongEdgeMm(clamped);
    setLongEdgeDraft(String(clamped));
  };

  const size = useMemo(
    () => deriveCustomSizeFromLongEdge(longEdgeMm, pixelWidth, pixelHeight),
    [longEdgeMm, pixelHeight, pixelWidth],
  );

  const selectedMedia: CustomMediaOption | null =
    mediaOptions.find((item) => item.id === mediaId) ?? null;
  const isRth = selectedMedia?.kind === "rth_canvas";
  const effectiveFrame: CustomFrameStyleId = isRth ? "none" : frameStyle;

  const pricing = useMemo(() => {
    if (!mediaId) return null;
    return computeCustomPrintPricing({
      widthMm: size.width_mm,
      heightMm: size.height_mm,
      mediaId,
      frameStyle: effectiveFrame,
      mediaMarkupFactor,
      mediaBasePriceAud,
      frameMarkupFactor,
      frameBasePriceAud,
      frameRates,
      rthCanvasRates,
      papers,
    });
  }, [
    effectiveFrame,
    frameBasePriceAud,
    frameMarkupFactor,
    frameRates,
    mediaBasePriceAud,
    mediaId,
    mediaMarkupFactor,
    papers,
    rthCanvasRates,
    size.height_mm,
    size.width_mm,
  ]);

  const createVariant = async () => {
    const response = await fetch("/api/shop/custom-print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: product.id,
        long_edge_mm: longEdgeMm,
        media_id: mediaId,
        frame_style: effectiveFrame,
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

  const handleAddToCart = async () => {
    if (!purchasesAllowed || !pricing) return;
    setBusy("cart");
    setError(null);
    try {
      const created = await createVariant();
      const result = addItem({
        variant_id: created.variant_id,
        product_title: product.title,
        variant_label: created.variant_label,
        price_aud: created.price_aud,
        slug: product.slug,
        image_url: product.image_url,
        quantity: 1,
        fulfilment_provider: created.fulfilment_provider ?? "pixelperfect",
      });
      if (!result.ok) return;
      router.push("/cart");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add to cart.");
    } finally {
      setBusy(null);
    }
  };

  const handleBuyNow = async () => {
    if (!purchasesAllowed || !pricing) return;
    setBusy("buy");
    setError(null);
    try {
      const created = await createVariant();
      const result = addItem({
        variant_id: created.variant_id,
        product_title: product.title,
        variant_label: created.variant_label,
        price_aud: created.price_aud,
        slug: product.slug,
        image_url: product.image_url,
        quantity: 1,
        fulfilment_provider: created.fulfilment_provider ?? "pixelperfect",
      });
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
    if (!isAdmin || !pricing) return;
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
    if (!pricing) return;
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
    if (!editOrderId || !editItemId || !pricing) return;
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

  const fineArt = mediaOptions.filter((item) => item.kind === "paper" && item.printType === "fine_art");
  const photo = mediaOptions.filter((item) => item.kind === "paper" && item.printType === "photo");
  const canvasPapers = mediaOptions.filter(
    (item) => item.kind === "paper" && item.printType === "canvas",
  );
  const rth = mediaOptions.filter((item) => item.kind === "rth_canvas");

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
          ← Back to standard options
        </Link>
      </p>

      <div className={styles.layout}>
        <div className={styles.visual}>
          <FramedPreview
            frame={mapCustomFrameToPreview(effectiveFrame)}
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
          <p className={styles.subtitle}>Custom print</p>
          {editionSize ? <p className={styles.edition}>Edition of {editionSize}</p> : null}

          <div className={styles.priceSticky}>
            <p className={styles.price}>
              {pricing ? formatAUD(pricing.retailCents) : "Price unavailable"}
            </p>
            {pricing ? (
              <p className={styles.priceBreakdown}>
                Media {formatAUD(Math.round(pricing.mediaRetailAud * 100))}
                {pricing.frameRetailAud > 0
                  ? ` · Frame ${formatAUD(Math.round(pricing.frameRetailAud * 100))}`
                  : ""}
              </p>
            ) : (
              <p className={styles.muted}>
                This combination is outside online pricing (try a smaller size or Standard frame).
              </p>
            )}
          </div>

          <label className={styles.field}>
            <span className={styles.legend}>Long edge</span>
            <input
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
              <span className={styles.muted}>mm</span>
            </div>
            <p className={styles.dimension}>{formatShopDimensions(size.width_mm, size.height_mm)}</p>
          </label>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Media</legend>
            <MediaGroup title="Fine art papers" options={fineArt} mediaId={mediaId} onChange={setMediaId} />
            <MediaGroup title="Photo papers" options={photo} mediaId={mediaId} onChange={setMediaId} />
            <MediaGroup title="Canvas sheet" options={canvasPapers} mediaId={mediaId} onChange={setMediaId} />
            <MediaGroup title="Ready to hang" options={rth} mediaId={mediaId} onChange={setMediaId} />
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Framing</legend>
            {isRth ? (
              <p className={styles.muted}>Ready-to-hang canvas includes stretch and wire — framing is not offered.</p>
            ) : (
              <>
                <p className={styles.frameNote}>{FRAME_NOTE_PERSPEX}</p>
                <div className={styles.options}>
                  {CUSTOM_FRAME_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className={`${styles.option} ${option.sampleImage ? styles.optionWithSample : ""} ${
                        effectiveFrame === option.id ? styles.optionActive : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="frame"
                        checked={effectiveFrame === option.id}
                        onChange={() => setFrameStyle(option.id)}
                      />
                      {option.sampleImage ? (
                        <span className={styles.optionSample}>
                          <img
                            src={option.sampleImage}
                            alt={`${option.label} moulding sample`}
                            width={112}
                            height={112}
                            className={styles.optionSampleImage}
                            loading="lazy"
                            decoding="async"
                          />
                        </span>
                      ) : null}
                      <span>
                        <span className={styles.optionTitle}>{option.label}</span>
                        <span className={styles.optionMeta}>{option.summary}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {effectiveFrame !== "none" ? (
                  <fieldset className={styles.fieldset}>
                    <legend className={styles.legend}>Frame colour</legend>
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
                            name="custom-frame-colour"
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
              </>
            )}
          </fieldset>

          <div className={styles.actions}>
            {isEditingOrderItem ? (
              <div className={styles.adminPrint}>
                <p className={styles.adminHint}>
                  Updating this print on the existing order. Choose size, paper, and frame, then save.
                </p>
                <button
                  className={`button-solid ${styles.button}`}
                  type="button"
                  disabled={!pricing || busy !== null}
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
                      disabled={!pricing || busy !== null}
                      onClick={() => void handleAddToCart()}
                    >
                      {busy === "cart" ? "Adding…" : "Add to cart"}
                    </button>
                    <button
                      className={`button-outline ${styles.button}`}
                      type="button"
                      disabled={!pricing || busy !== null}
                      onClick={() => void handleBuyNow()}
                    >
                      {busy === "buy"
                        ? "Redirecting…"
                        : itemCount > 0
                          ? "Buy now (includes cart)"
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
                      disabled={!pricing || busy !== null || studioOrderDialogOpen}
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
            Made to order · Shipped with Perspex if framed (not glass) · Free shipping within Australia
          </p>
        </aside>
      </div>
      <StudioOrderDestinationDialog
        open={studioOrderDialogOpen}
        title="Order for studio"
        description={`No payment and no edition number. Add this custom print (${formatShopDimensions(size.width_mm, size.height_mm)}${selectedMedia ? ` · ${selectedMedia.label}` : ""}) to an open studio order, or start a new one.`}
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

function MediaGroup({
  title,
  options,
  mediaId,
  onChange,
}: {
  title: string;
  options: CustomMediaOption[];
  mediaId: string;
  onChange: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className={styles.mediaGroup}>
      <h3 className={styles.mediaGroupTitle}>{title}</h3>
      <div className={styles.options}>
        {options.map((option) => (
          <label
            key={option.id}
            className={`${styles.option} ${mediaId === option.id ? styles.optionActive : ""}`}
          >
            <input
              type="radio"
              name="media"
              checked={mediaId === option.id}
              onChange={() => onChange(option.id)}
            />
            <span>
              <span className={styles.optionTitle}>{option.label}</span>
              {option.id === CUSTOM_RTH_CANVAS_ID ? (
                <span className={styles.optionMeta}>Print, stretch, and wire included</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
