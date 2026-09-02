"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { adminClientFetch, adminClientFetchError } from "../../lib/admin-client-fetch";
import {
  deriveAspectPreservingSizeMm,
} from "../../lib/print-size";
import {
  formatVariantLabel,
  PAPER_OPTIONS,
} from "../../lib/print-catalogue";
import type { Gallery } from "../../lib/galleries";
import { DEFAULT_PRINT_PRICE_BASE_AUD, DEFAULT_PRINT_PRICE_MARKUP_FACTOR } from "../../lib/print-markup";
import {
  DEFAULT_PRINT_FRAME_BASE_AUD,
  DEFAULT_PRINT_FRAME_MARKUP_FACTOR,
  type FrameRateBand,
  type RthCanvasRateBand,
} from "../../lib/print-frame-pricing";
import type { PosterFactoryCatalogue } from "../../lib/posterfactory";
import { buildOfferVariantsForProduct, type OfferVariantDraft } from "../../lib/print-offer";
import type { Theme, VariantTemplate } from "../../lib/supabase/types";
import type { OpenStudioOrder } from "../../lib/studio-orders";
import { isValidProductImageUrl } from "../../lib/utils/site-content-image";
import { normalizeAudioFields } from "../../lib/photo-audio";
import { slugify } from "../../lib/utils/slugify";
import styles from "./ProductEditorForm.module.css";
import { GalleryPicker } from "./GalleryPicker";
import { OfferVariantMatrix, useOfferSelection } from "./OfferVariantMatrix";
import { ProductVariantPanel, type VariantInput } from "./ProductVariantPanel";
import { ProductWallQrCodes } from "./ProductWallQrCodes";
import { ProductAudioCaptureModal } from "./ProductAudioCaptureModal";
import { ThemeSelector } from "./ThemeSelector";
import { StudioOrderDestinationDialog, loadOpenStudioOrders } from "../StudioOrderDestinationDialog";

type ImageInput = {
  id?: string;
  image_url: string;
  alt_text: string;
  sort_order: string;
  is_primary: boolean;
};

type ProductEditorInitialData = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  product_type: "print" | "merchandise";
  location_tag: string;
  installation_tag: string;
  photo_type_tag: string;
  is_available: boolean;
  is_featured: boolean;
  gallery_id: string | null;
  theme_ids: string[];
  variants: VariantInput[];
  images: ImageInput[];
  audio_url?: string;
  audio_duration?: string;
  audio_transcript?: string;
};

type ProductEditorFormProps = {
  mode: "new" | "edit";
  initialData?: ProductEditorInitialData;
  variantTemplates: VariantTemplate[];
  themes: Theme[];
  galleries: Gallery[];
  masterPixelWidth?: number | null;
  masterPixelHeight?: number | null;
  masterFilename?: string | null;
};

const defaultFineArtPaper = PAPER_OPTIONS.find((paper) => paper.printType === "fine_art")?.label ?? "";

const createBlankVariant = (): VariantInput => ({
  template_id: "",
  variant_label: "",
  price_dollars: "",
  edition_size: "",
  stock_quantity: "",
  stripe_price_id: "",
  width_mm: "",
  height_mm: "",
  border_mm: "0",
  paper_type: defaultFineArtPaper,
  print_type: "fine_art",
  print_dpi: "300",
  source_print_profile_id: "",
  destination_print_profile_id: "",
  tier_label: "",
  finish: "",
  is_framed: false,
  frame_type: "",
  lab_cost_dollars: "",
  suggested_retail_min_dollars: "",
  suggested_retail_max_dollars: "",
  turnaround_days_min: "",
  turnaround_days_max: "",
  shipping_class: "",
  fulfilment_notes: "",
  fulfilment_provider: "pixelperfect",
  fulfilment_class: "fine_art",
  supplier_product_code: "",
  aspect_ratio: "",
  canvas_wrap_mm: "",
  wrap_style: "",
  front_face_width_mm: "",
  front_face_height_mm: "",
  fit_mode: "custom_size",
  crop_offset: "0",
  size_lock: "long_edge",
  is_active: true,
});

const createBlankImage = (): ImageInput => ({
  image_url: "",
  alt_text: "",
  sort_order: "0",
  is_primary: false,
});

const offerDraftToVariantInput = (draft: OfferVariantDraft, editionSize: string): VariantInput => ({
  ...createBlankVariant(),
  variant_label: draft.variant_label,
  price_dollars: (draft.price_aud / 100).toFixed(2),
  edition_size: editionSize || String(draft.edition_size),
  width_mm: String(draft.width_mm),
  height_mm: String(draft.height_mm),
  border_mm: String(draft.border_mm),
  paper_type: draft.paper_type,
  print_type: draft.print_type,
  print_dpi: String(draft.print_dpi),
  tier_label: draft.tier_label,
  finish: draft.finish,
  is_framed: draft.is_framed,
  frame_type: draft.frame_type ?? "",
  lab_cost_dollars: (draft.lab_cost_aud / 100).toFixed(2),
  fulfilment_notes: draft.fulfilment_notes,
  fulfilment_provider: draft.fulfilment_provider,
  fulfilment_class: draft.fulfilment_class,
  supplier_product_code: draft.supplier_product_code ?? "",
  aspect_ratio: draft.aspect_ratio ?? "",
  fit_mode: "custom_size",
  crop_offset: "0",
  size_lock: "long_edge",
  is_active: true,
});

const centsToDollars = (value: number | null): string => (value === null ? "" : (value / 100).toFixed(2));

const applyTemplateToVariant = (
  variant: VariantInput,
  template: VariantTemplate,
  masterPixelWidth: number | null,
  masterPixelHeight: number | null,
): VariantInput => {
  const base: VariantInput = {
    ...variant,
    template_id: template.id,
    variant_label: template.variant_label,
    price_dollars: (template.base_price_aud / 100).toFixed(2),
    edition_size: template.edition_size?.toString() ?? "",
    border_mm: template.border_mm.toString(),
    paper_type: template.paper_type,
    print_type: template.print_type || "fine_art",
    print_dpi: template.print_dpi.toString(),
    source_print_profile_id: template.source_print_profile_id ?? "",
    destination_print_profile_id: template.destination_print_profile_id ?? "",
    tier_label: template.tier_label ?? "",
    finish: template.finish ?? "",
    is_framed: template.is_framed,
    frame_type: template.frame_type ?? "",
    lab_cost_dollars: centsToDollars(template.lab_cost_aud),
    suggested_retail_min_dollars: centsToDollars(template.suggested_retail_min_aud),
    suggested_retail_max_dollars: centsToDollars(template.suggested_retail_max_aud),
    turnaround_days_min: template.turnaround_days_min?.toString() ?? "",
    turnaround_days_max: template.turnaround_days_max?.toString() ?? "",
    shipping_class: template.shipping_class ?? "",
    fulfilment_notes: template.fulfilment_notes ?? "",
    fulfilment_provider: "pixelperfect",
    fulfilment_class: template.is_framed ? "framed" : template.print_type === "canvas" ? "canvas" : "fine_art",
    supplier_product_code: "",
    canvas_wrap_mm: template.canvas_wrap_mm?.toString() ?? "",
    wrap_style: template.wrap_style ?? "",
    front_face_width_mm: template.front_face_width_mm?.toString() ?? "",
    front_face_height_mm: template.front_face_height_mm?.toString() ?? "",
    fit_mode: "custom_size",
    crop_offset: "0",
    size_lock: "long_edge",
  };

  if (masterPixelWidth && masterPixelHeight && masterPixelWidth > 0 && masterPixelHeight > 0) {
    const longEdge = Math.max(template.width_mm, template.height_mm);
    const size = deriveAspectPreservingSizeMm(longEdge, masterPixelWidth, masterPixelHeight);
    return {
      ...base,
      width_mm: String(size.width_mm),
      height_mm: String(size.height_mm),
      aspect_ratio: size.aspect_ratio ?? "",
      variant_label: formatVariantLabel(size.width_mm, size.height_mm, template.paper_type),
    };
  }

  return {
    ...base,
    width_mm: template.width_mm.toString(),
    height_mm: template.height_mm.toString(),
    aspect_ratio: template.aspect_ratio ?? "",
  };
};

export function ProductEditorForm({
  mode,
  initialData,
  variantTemplates,
  themes,
  galleries,
  masterPixelWidth = null,
  masterPixelHeight = null,
  masterFilename = null,
}: ProductEditorFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialData?.slug));
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [productType, setProductType] = useState<"print" | "merchandise">(initialData?.product_type ?? "print");
  const [locationTag, setLocationTag] = useState(initialData?.location_tag ?? "");
  const [photoTypeTag, setPhotoTypeTag] = useState(initialData?.photo_type_tag ?? "");
  const [isAvailable, setIsAvailable] = useState(initialData?.is_available ?? true);
  const [isFeatured, setIsFeatured] = useState(initialData?.is_featured ?? false);
  const [galleryId, setGalleryId] = useState<string | null>(initialData?.gallery_id ?? null);
  const [selectedThemeIds, setSelectedThemeIds] = useState(initialData?.theme_ids ?? []);
  const [themeOptions, setThemeOptions] = useState(themes);
  const [variants, setVariants] = useState<VariantInput[]>(
    initialData?.variants.length
      ? initialData.variants
      : mode === "new" && (initialData?.product_type ?? "print") === "print"
        ? []
        : [createBlankVariant()],
  );
  const [expandedVariantIndexes, setExpandedVariantIndexes] = useState<Set<number>>(() => new Set());
  const [productDetailsExpanded, setProductDetailsExpanded] = useState(mode === "new");
  const [variantsPanelExpanded, setVariantsPanelExpanded] = useState(mode === "new");
  const [images, setImages] = useState<ImageInput[]>(initialData?.images ?? []);
  const [audioUrl, setAudioUrl] = useState(initialData?.audio_url ?? "");
  const [audioDuration, setAudioDuration] = useState(initialData?.audio_duration ?? "");
  const [audioTranscript, setAudioTranscript] = useState(initialData?.audio_transcript ?? "");
  const [audioCaptureOpen, setAudioCaptureOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creatingTestOrderVariantId, setCreatingTestOrderVariantId] = useState<string | null>(null);
  const [creatingStudioOrderVariantId, setCreatingStudioOrderVariantId] = useState<string | null>(null);
  const [studioOrderDialog, setStudioOrderDialog] = useState<{
    variant: VariantInput;
    orders: OpenStudioOrder[];
  } | null>(null);
  const [testOrderMessage, setTestOrderMessage] = useState<string | null>(null);
  const [preparingPrintVariantId, setPreparingPrintVariantId] = useState<string | null>(null);
  const [printPrepareMessages, setPrintPrepareMessages] = useState<Record<string, string>>({});
  const [rebuildingOffer, setRebuildingOffer] = useState(false);
  const [offerPixelWidth, setOfferPixelWidth] = useState(
    masterPixelWidth && masterPixelWidth > 0 ? String(masterPixelWidth) : "",
  );
  const [offerPixelHeight, setOfferPixelHeight] = useState(
    masterPixelHeight && masterPixelHeight > 0 ? String(masterPixelHeight) : "",
  );
  const [offerEditionSize, setOfferEditionSize] = useState("10");
  const [markupFactor, setMarkupFactor] = useState(DEFAULT_PRINT_PRICE_MARKUP_FACTOR);
  const [basePriceAud, setBasePriceAud] = useState(DEFAULT_PRINT_PRICE_BASE_AUD);
  const [frameMarkupFactor, setFrameMarkupFactor] = useState(DEFAULT_PRINT_FRAME_MARKUP_FACTOR);
  const [frameBasePriceAud, setFrameBasePriceAud] = useState(DEFAULT_PRINT_FRAME_BASE_AUD);
  const [frameRates, setFrameRates] = useState<FrameRateBand[] | undefined>(undefined);
  const [rthCanvasRates, setRthCanvasRates] = useState<RthCanvasRateBand[] | undefined>(undefined);
  const [posterfactory, setPosterfactory] = useState<PosterFactoryCatalogue | undefined>(undefined);
  const isNewPrint = mode === "new" && productType === "print";
  const offerPixelW = Number.parseInt(offerPixelWidth, 10);
  const offerPixelH = Number.parseInt(offerPixelHeight, 10);
  const offerDrafts = useMemo((): OfferVariantDraft[] => {
    if (!isNewPrint || !Number.isInteger(offerPixelW) || !Number.isInteger(offerPixelH) || offerPixelW <= 0 || offerPixelH <= 0) {
      return [];
    }
    try {
      return buildOfferVariantsForProduct({
        pixelWidth: offerPixelW,
        pixelHeight: offerPixelH,
        editionSize: Number.parseInt(offerEditionSize, 10) || 10,
        mediaMarkupFactor: markupFactor,
        mediaBasePriceAud: basePriceAud,
        frameMarkupFactor,
        frameBasePriceAud,
        frameRates,
        rthCanvasRates,
        posterfactory,
      });
    } catch {
      return [];
    }
  }, [
    basePriceAud,
    frameBasePriceAud,
    frameMarkupFactor,
    frameRates,
    isNewPrint,
    markupFactor,
    offerEditionSize,
    offerPixelH,
    offerPixelW,
    rthCanvasRates,
    posterfactory,
  ]);
  const offerSelection = useOfferSelection(offerDrafts);

  useEffect(() => {
    if (mode !== "new") return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await adminClientFetch("/api/admin/print-pricing/offer");
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as {
          markup_factor?: number;
          base_price_aud?: number;
          frame_markup_factor?: number;
          frame_base_price_aud?: number;
          frame_rates?: FrameRateBand[];
          rth_canvas_rates?: RthCanvasRateBand[];
          posterfactory?: PosterFactoryCatalogue;
        };
        if (cancelled) return;
        if (typeof body.markup_factor === "number") setMarkupFactor(body.markup_factor);
        if (typeof body.base_price_aud === "number") setBasePriceAud(body.base_price_aud);
        if (typeof body.frame_markup_factor === "number") setFrameMarkupFactor(body.frame_markup_factor);
        if (typeof body.frame_base_price_aud === "number") setFrameBasePriceAud(body.frame_base_price_aud);
        if (Array.isArray(body.frame_rates)) setFrameRates(body.frame_rates);
        if (Array.isArray(body.rth_canvas_rates)) setRthCanvasRates(body.rth_canvas_rates);
        if (body.posterfactory) setPosterfactory(body.posterfactory);
      } catch {
        // Keep defaults; formula prices still work from seed rates.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const activeVariantTemplates = useMemo(
    () => variantTemplates.filter((template) => template.is_active),
    [variantTemplates],
  );

  const slugSuggestion = useMemo(() => slugify(title), [title]);

  const applySlugSuggestion = (nextTitle: string) => {
    if (!slugTouched) {
      setSlug(slugify(nextTitle));
    }
  };

  const setPrimaryImage = (index: number) => {
    setImages((current) => current.map((image, imageIndex) => ({ ...image, is_primary: imageIndex === index })));
  };

  const handleSave = async () => {
    if (!title.trim() || !slug.trim()) {
      setError("Title and slug are required.");
      return;
    }
    const offerInputs = isNewPrint
      ? offerSelection.selectedDrafts.map((draft) => offerDraftToVariantInput(draft, offerEditionSize))
      : [];
    const variantsForSave = isNewPrint ? [...offerInputs, ...variants] : variants;

    if (variantsForSave.length === 0) {
      setError(
        isNewPrint
          ? "Select at least one standard print option, or add a variant."
          : "At least one variant is required.",
      );
      return;
    }
    if (isNewPrint && offerDrafts.length > 0 && !offerSelection.pricesValid) {
      setError("Check retail prices on the selected print options.");
      return;
    }

    const normalizedVariants = variantsForSave.map((variant) => ({
      id: variant.id,
      variant_label: variant.variant_label.trim(),
      price_aud: Math.round((Number.parseFloat(variant.price_dollars || "0") || 0) * 100),
      edition_size: variant.edition_size ? Number.parseInt(variant.edition_size, 10) : null,
      stock_quantity: variant.stock_quantity ? Number.parseInt(variant.stock_quantity, 10) : null,
      stripe_price_id: null,
      width_mm: variant.width_mm ? Number.parseInt(variant.width_mm, 10) : null,
      height_mm: variant.height_mm ? Number.parseInt(variant.height_mm, 10) : null,
      border_mm: variant.border_mm ? Number.parseInt(variant.border_mm, 10) : 0,
      paper_type: variant.paper_type.trim() || null,
      print_type: variant.print_type.trim() || null,
      print_dpi: variant.print_dpi ? Number.parseInt(variant.print_dpi, 10) : null,
      source_print_profile_id: variant.source_print_profile_id || null,
      destination_print_profile_id: variant.destination_print_profile_id || null,
      tier_label: variant.tier_label.trim() || null,
      finish: variant.finish.trim() || null,
      is_framed: variant.is_framed,
      frame_type: variant.frame_type.trim() || null,
      lab_cost_aud: variant.lab_cost_dollars
        ? Math.round((Number.parseFloat(variant.lab_cost_dollars) || 0) * 100)
        : null,
      suggested_retail_min_aud: variant.suggested_retail_min_dollars
        ? Math.round((Number.parseFloat(variant.suggested_retail_min_dollars) || 0) * 100)
        : null,
      suggested_retail_max_aud: variant.suggested_retail_max_dollars
        ? Math.round((Number.parseFloat(variant.suggested_retail_max_dollars) || 0) * 100)
        : null,
      turnaround_days_min: variant.turnaround_days_min ? Number.parseInt(variant.turnaround_days_min, 10) : null,
      turnaround_days_max: variant.turnaround_days_max ? Number.parseInt(variant.turnaround_days_max, 10) : null,
      shipping_class: variant.shipping_class.trim() || null,
      fulfilment_notes: variant.fulfilment_notes.trim() || null,
      fulfilment_provider: variant.fulfilment_provider.trim() || null,
      fulfilment_class: variant.fulfilment_class.trim() || null,
      supplier_product_code: variant.supplier_product_code.trim() || null,
      aspect_ratio: variant.aspect_ratio.trim() || null,
      canvas_wrap_mm: variant.canvas_wrap_mm ? Number.parseInt(variant.canvas_wrap_mm, 10) : null,
      wrap_style: variant.wrap_style.trim() || null,
      front_face_width_mm: variant.front_face_width_mm ? Number.parseInt(variant.front_face_width_mm, 10) : null,
      front_face_height_mm: variant.front_face_height_mm ? Number.parseInt(variant.front_face_height_mm, 10) : null,
      fit_mode: variant.fit_mode === "custom_size" ? "custom_size" : "cover_crop",
      crop_offset: Number.parseFloat(variant.crop_offset || "0") || 0,
      size_lock:
        variant.fit_mode === "custom_size" &&
        (variant.size_lock === "long_edge" || variant.size_lock === "width" || variant.size_lock === "height")
          ? variant.size_lock
          : null,
      is_active: variant.is_active,
    }));

    if (normalizedVariants.some((variant) => !variant.variant_label || variant.price_aud < 0)) {
      setError("Each variant needs a label and valid price.");
      return;
    }
    if (
      productType === "print" &&
      normalizedVariants.some(
        (variant) =>
          !variant.width_mm ||
          !variant.height_mm ||
          variant.width_mm <= 0 ||
          variant.height_mm <= 0 ||
          !variant.print_dpi ||
          variant.print_dpi <= 0,
      )
    ) {
      setError("Each print variant must have positive width, height, and print DPI.");
      return;
    }

    const normalizedImages = images.map((image) => ({
      id: image.id,
      image_url: image.image_url.trim(),
      alt_text: image.alt_text.trim() || null,
      sort_order: Number.parseInt(image.sort_order || "0", 10) || 0,
      is_primary: image.is_primary,
    }));

    if (normalizedImages.some((image) => image.image_url.length > 0 && !isValidProductImageUrl(image.image_url))) {
      setError("Image URLs must be absolute http(s) URLs or local /images/ paths.");
      return;
    }

    const audioFields = normalizeAudioFields({
      audio_url: audioUrl,
      audio_duration: audioDuration,
      audio_transcript: audioTranscript,
    });
    if (!audioFields.ok) {
      setError(audioFields.error);
      return;
    }

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      product_type: productType,
      location_tag: locationTag ? locationTag : null,
      installation_tag: initialData?.installation_tag || null,
      photo_type_tag: photoTypeTag ? photoTypeTag : null,
      is_available: isAvailable,
      is_featured: isFeatured,
      gallery_id: galleryId,
      theme_ids: selectedThemeIds,
      variants: normalizedVariants,
      images: normalizedImages.filter((image) => image.image_url),
      audio_url: audioFields.value.audio_url,
      audio_duration: audioFields.value.audio_duration,
      audio_transcript: audioFields.value.audio_transcript,
    };

    setSaving(true);
    setError(null);

    const endpoint = mode === "new" ? "/api/admin/products" : `/api/admin/products/${initialData?.id}`;
    const method = mode === "new" ? "POST" : "PATCH";

    try {
      const response = await adminClientFetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({ error: "Failed to save product." }))) as {
          error?: string;
        };
        setError(data.error ?? "Failed to save product.");
        setSaving(false);
        return;
      }

      router.push("/admin/products");
      router.refresh();
    } catch (saveError) {
      setError(adminClientFetchError(saveError));
      setSaving(false);
    }
  };

  const handleDeleteOrArchive = async () => {
    if (mode !== "edit" || !initialData?.id) return;

    const confirmed = window.confirm(
      "Archive/delete this product? If it has ever had an order, it will only be deactivated and archived. If it has no orders, it will be removed along with its variants, image rows, local image files, and Stripe catalogue entries will be archived.",
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    const response = await fetch(`/api/admin/products/${initialData.id}`, {
      method: "DELETE",
    });

    const data = (await response.json().catch(() => ({ error: "Failed to archive/delete product." }))) as {
      action?: "archived" | "deleted";
      error?: string;
      warning?: string;
    };

    if (!response.ok) {
      setError(data.error ?? "Failed to archive/delete product.");
      setDeleting(false);
      return;
    }

    if (data.warning) {
      setError(data.warning);
      setDeleting(false);
      return;
    }

    router.push("/admin/products");
    router.refresh();
  };

  const createTestOrder = async (variant: VariantInput) => {
    if (!variant.id) {
      setError("Save the product before creating a test order.");
      return;
    }

    if (!variant.is_active) {
      setError("Variant must be active before creating a test order.");
      return;
    }

    const confirmed = window.confirm(
      `Create a paid fulfilment test order for "${variant.variant_label}" without Stripe? Prefer On-site sale for real desk sales.`,
    );
    if (!confirmed) return;

    setCreatingTestOrderVariantId(variant.id);
    setError(null);
    setTestOrderMessage(null);

    const response = await fetch("/api/admin/orders/manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "test",
        variant_id: variant.id,
        quantity: 1,
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string; order_number?: string }
      | null;

    if (!response.ok) {
      setError(body?.error ?? "Failed to create test order.");
      setCreatingTestOrderVariantId(null);
      return;
    }

    setTestOrderMessage(`Created test order ${body?.order_number ?? ""}.`);
    setCreatingTestOrderVariantId(null);
    router.refresh();
  };

  const openStudioOrderDialog = async (variant: VariantInput) => {
    if (!variant.id) {
      setError("Save the product before creating a studio order.");
      return;
    }

    setCreatingStudioOrderVariantId(variant.id);
    setError(null);
    setTestOrderMessage(null);

    try {
      const orders = await loadOpenStudioOrders();
      setStudioOrderDialog({ variant, orders });
    } catch (studioError) {
      setError(adminClientFetchError(studioError));
    } finally {
      setCreatingStudioOrderVariantId(null);
    }
  };

  const createStudioOrder = async (
    variant: VariantInput,
    existingOrderId: string | null,
    quantity: number,
  ) => {
    if (!variant.id) {
      setError("Save the product before creating a studio order.");
      return;
    }

    setCreatingStudioOrderVariantId(variant.id);
    setError(null);
    setTestOrderMessage(null);

    const response = await adminClientFetch("/api/admin/orders/manual", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mode: "studio",
        variant_id: variant.id,
        quantity,
        ...(existingOrderId ? { existing_order_id: existingOrderId } : {}),
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string; order_number?: string; added_to_existing?: boolean }
      | null;

    if (!response.ok) {
      setError(body?.error ?? "Failed to create studio order.");
      setCreatingStudioOrderVariantId(null);
      return;
    }

    setStudioOrderDialog(null);
    setTestOrderMessage(
      body?.added_to_existing
        ? `Added to studio order ${body?.order_number ?? ""}. Open Fulfilment for specs and the print file.`
        : `Created studio order ${body?.order_number ?? ""}. Open Fulfilment for specs and the print file.`,
    );
    setCreatingStudioOrderVariantId(null);
    router.refresh();
  };

  const preparePrintFile = async (variant: VariantInput) => {
    if (!initialData?.id || !variant.id) {
      setError("Save the product before preparing a print file.");
      return;
    }
    if (!masterFilename) {
      setError("This product has no master TIFF on its variants.");
      return;
    }
    if (!variant.width_mm || !variant.height_mm) {
      setError("Variant needs width and height before preparing a print file.");
      return;
    }

    setPreparingPrintVariantId(variant.id);
    setError(null);
    setPrintPrepareMessages((current) => ({
      ...current,
      [variant.id!]: "Preparing lab TIFF from master (can take a few minutes for large files)…",
    }));

    try {
      const response = await adminClientFetch(
        `/api/admin/products/${initialData.id}/variants/${variant.id}/prepare-print`,
        { method: "POST", timeoutMs: 600_000 },
      );
      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            filename?: string;
            paper_type?: string | null;
            finish?: string | null;
            is_framed?: boolean | null;
            width_mm?: number;
            height_mm?: number;
          }
        | null;

      if (!response.ok) {
        throw new Error(body?.error ?? "Failed to prepare print file.");
      }

      const labBits = [
        body?.paper_type ? `Paper: ${body.paper_type}` : null,
        body?.finish ? `Finish: ${body.finish}` : null,
        body?.is_framed ? "Framed" : "Unframed",
        body?.width_mm && body?.height_mm ? `${Math.round(body.width_mm)}×${Math.round(body.height_mm)} mm` : null,
      ].filter(Boolean);

      setPrintPrepareMessages((current) => ({
        ...current,
        [variant.id!]: `Ready: ${body?.filename ?? "TIFF"}${labBits.length ? ` · ${labBits.join(" · ")}` : ""}. Use Download TIFF, then send to Pixel Perfect manually.`,
      }));
    } catch (prepareError) {
      const message = prepareError instanceof Error ? prepareError.message : adminClientFetchError(prepareError);
      setError(message);
      setPrintPrepareMessages((current) => {
        const next = { ...current };
        delete next[variant.id!];
        return next;
      });
    } finally {
      setPreparingPrintVariantId(null);
    }
  };

  const downloadPrintFile = (variant: VariantInput) => {
    if (!initialData?.id || !variant.id) {
      setError("Save the product before downloading a print file.");
      return;
    }
    window.location.href = `/api/admin/products/${initialData.id}/variants/${variant.id}/print-file?mode=download`;
  };

  const saveActions = (
    <>
      <button className={styles.btn} type="button" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Product"}
      </button>
      <Link className={styles.btnSecondary} href="/admin/products">
        Cancel
      </Link>
    </>
  );

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1>{mode === "new" ? "Add New Product" : "Edit Product"}</h1>
        <div className={styles.footerActions}>{saveActions}</div>
      </div>

      <div className={styles.form}>
        <details
          className={styles.panel}
          open={productDetailsExpanded}
          onToggle={(event) => setProductDetailsExpanded(event.currentTarget.open)}
        >
          <summary className={styles.panelSummary}>
            <span className={styles.variantHeading}>
              <span className={styles.variantChevron} aria-hidden="true">
                {productDetailsExpanded ? "▾" : "▸"}
              </span>
              Product Details
              {title.trim() ? ` ${title.trim()}` : ""}
            </span>
          </summary>
          <div className={styles.variantBody}>
          <div className={styles.grid}>
            <label>
              Title
              <input
                value={title}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  setTitle(nextTitle);
                  applySlugSuggestion(nextTitle);
                }}
                required
              />
            </label>
            <label>
              Slug
              <input
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
                required
              />
            </label>
            <small className={styles.hint}>Suggested: {slugSuggestion || "n/a"}</small>

            <label className={styles.spanFull}>
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </label>

            <p className={styles.hint}>
              Hear the story — optional spoken recording. Leave blank for photographs without audio.
            </p>
            <div className={styles.spanFull}>
              <button
                className={styles.btnSecondary}
                type="button"
                onClick={() => setAudioCaptureOpen(true)}
              >
                {audioUrl.trim() ? "Replace audio" : "Record, upload, or reuse audio"}
              </button>
            </div>
            <label>
              Audio URL
              <input
                value={audioUrl}
                onChange={(event) => setAudioUrl(event.target.value)}
                placeholder="/audio/hiding-in-plain-sight.mp3"
              />
            </label>
            <label>
              Audio duration
              <input
                value={audioDuration}
                onChange={(event) => setAudioDuration(event.target.value)}
                placeholder="0:47"
              />
            </label>
            <label className={styles.spanFull}>
              Audio transcript
              <textarea
                value={audioTranscript}
                onChange={(event) => setAudioTranscript(event.target.value)}
                rows={5}
                placeholder="Indexable transcript of the spoken story"
              />
            </label>
            <small className={styles.hint}>
              Record or upload a new file, or reuse a recording already attached to another photograph. New files are
              named to match this product and transcribed. Reused recordings keep their existing file and transcript.
              Duration is <code>m:ss</code>.
            </small>

            <label>
              Product Type
              <select
                value={productType}
                onChange={(event) => {
                  const nextType = event.target.value as "print" | "merchandise";
                  setProductType(nextType);
                  if (mode !== "new") return;
                  if (nextType === "merchandise" && variants.length === 0) {
                    setVariants([createBlankVariant()]);
                  }
                  if (nextType === "print") {
                    const onlyBlank =
                      variants.length === 1 && !variants[0]?.id && !variants[0]?.variant_label.trim();
                    if (onlyBlank) setVariants([]);
                  }
                }}
              >
                <option value="print">print</option>
                <option value="merchandise">merchandise</option>
              </select>
            </label>

            <label>
              Location Tag
              <input
                value={locationTag}
                onChange={(event) => setLocationTag(event.target.value)}
                placeholder="e.g. Glasgow"
              />
            </label>

            <label>
              Photo Type Tag
              <select value={photoTypeTag} onChange={(event) => setPhotoTypeTag(event.target.value)}>
                <option value="">none</option>
                <option value="Still camera">Still camera</option>
                <option value="Drone">Drone</option>
                <option value="Underwater">Underwater</option>
              </select>
            </label>

            <div className={styles.checkRow}>
              <label>
                <input
                  type="checkbox"
                  checked={isAvailable}
                  onChange={(event) => setIsAvailable(event.target.checked)}
                />
                Is Available
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(event) => setIsFeatured(event.target.checked)}
                />
                Is Featured
              </label>
            </div>

            <GalleryPicker galleries={galleries} value={galleryId} onChange={setGalleryId} />
          </div>
          <h3>Themes</h3>
          <p className={styles.muted}>A photograph can belong to any number of themes.</p>
          <ThemeSelector
            themes={themeOptions}
            selectedThemeIds={selectedThemeIds}
            onChange={setSelectedThemeIds}
            onThemesChange={setThemeOptions}
          />
          </div>
        </details>

        <details
          className={styles.panel}
          open={variantsPanelExpanded}
          onToggle={(event) => setVariantsPanelExpanded(event.currentTarget.open)}
        >
          <summary className={styles.panelSummary}>
            <span className={styles.variantHeading}>
              <span className={styles.variantChevron} aria-hidden="true">
                {variantsPanelExpanded ? "▾" : "▸"}
              </span>
              Variants
              {variants.length ? ` ${variants.length}` : ""}
            </span>
          </summary>
          <div className={styles.variantBody}>
          <div className={styles.rowTop}>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginLeft: "auto" }}>
              {mode === "edit" && productType === "print" && initialData?.id ? (
                <button
                  className={styles.btnSecondary}
                  type="button"
                  disabled={rebuildingOffer}
                  onClick={() => {
                    void (async () => {
                      const confirmed = window.confirm(
                        "Rebuild this product’s print options to the standard A4/A3/A2/A0 × Tier 1/2 (print/mount), framed, and canvas (sheet/wrap) offer? Existing active variants will be deactivated.",
                      );
                      if (!confirmed) return;
                      setRebuildingOffer(true);
                      setError(null);
                      try {
                        const response = await fetch(`/api/admin/products/${initialData.id}/rebuild-offer`, {
                          method: "POST",
                        });
                        const body = (await response.json().catch(() => null)) as { error?: string } | null;
                        if (!response.ok) {
                          setError(body?.error ?? "Failed to rebuild offer.");
                          return;
                        }
                        router.refresh();
                      } catch {
                        setError("Failed to rebuild offer.");
                      } finally {
                        setRebuildingOffer(false);
                      }
                    })();
                  }}
                >
                  {rebuildingOffer ? "Rebuilding…" : "Rebuild offer options"}
                </button>
              ) : null}
              <button
                className={styles.btnSecondary}
                type="button"
                onClick={() => {
                  const nextIndex = variants.length;
                  setVariants((current) => [...current, createBlankVariant()]);
                  setExpandedVariantIndexes((expanded) => new Set(expanded).add(nextIndex));
                  setVariantsPanelExpanded(true);
                }}
              >
                {isNewPrint ? "Add extra variant" : "Add Variant"}
              </button>
            </div>
          </div>

          {isNewPrint ? (
            <div className={styles.offerSetup}>
              <p className={styles.muted}>
                Standard sizes × Tier 1 / Tier 2 / Canvas with print, mountboard, framed, and image-wrap finishes. Uncheck any this print should not offer, or override retail.
                Formula prices use markups from <Link href="/admin/print-profiles">Print Templates</Link>. Enter the
                master pixel size so millimetres stay aspect-true.
              </p>
              <div className={styles.grid}>
                <label>
                  Pixel width
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={offerPixelWidth}
                    onChange={(event) => setOfferPixelWidth(event.target.value)}
                  />
                </label>
                <label>
                  Pixel height
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={offerPixelHeight}
                    onChange={(event) => setOfferPixelHeight(event.target.value)}
                  />
                </label>
                <label>
                  Edition size
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={offerEditionSize}
                    onChange={(event) => setOfferEditionSize(event.target.value)}
                  />
                </label>
              </div>
              {offerDrafts.length > 0 ? (
                <OfferVariantMatrix drafts={offerDrafts} selection={offerSelection} />
              ) : (
                <p className={styles.muted}>
                  Enter master pixel width and height to load the standard offer, or add an extra variant below.
                </p>
              )}
              {variants.length > 0 ? <h3>Additional variants</h3> : null}
            </div>
          ) : null}

          {variants.map((variant, index) => {
            const isExpanded = expandedVariantIndexes.has(index);
            const variantHeading = `Variant ${index + 1}${
              variant.variant_label.trim() ? ` ${variant.variant_label.trim()}` : ""
            }`;
            return (
            <details
              key={`${variant.id ?? "new"}-${index}`}
              className={styles.row}
              open={isExpanded}
              onToggle={(event) => {
                const nextOpen = event.currentTarget.open;
                setExpandedVariantIndexes((current) => {
                  const next = new Set(current);
                  if (nextOpen) next.add(index);
                  else next.delete(index);
                  return next;
                });
              }}
            >
              <summary className={styles.variantSummary}>
                <span className={styles.variantHeading}>
                  <span className={styles.variantChevron} aria-hidden="true">
                    {isExpanded ? "▾" : "▸"}
                  </span>
                  {variantHeading}
                </span>
                <span className={styles.variantSummaryActions}>
                  <label
                    className={styles.variantActiveFlag}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={variant.is_active}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setVariants((current) =>
                          current.map((row, i) => (i === index ? { ...row, is_active: checked } : row)),
                        );
                      }}
                    />
                    Active
                  </label>
                  <button
                    className={styles.btnSecondary}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setVariants((current) => current.filter((_, i) => i !== index));
                      setExpandedVariantIndexes((current) => {
                        const next = new Set<number>();
                        for (const expandedIndex of current) {
                          if (expandedIndex < index) next.add(expandedIndex);
                          else if (expandedIndex > index) next.add(expandedIndex - 1);
                        }
                        return next;
                      });
                    }}
                    disabled={variants.length === 1 || Boolean(variant.has_order_items)}
                  >
                    {variant.has_order_items ? "Used in Orders" : "Delete"}
                  </button>
                </span>
              </summary>
              <div className={styles.variantBody}>
                <ProductVariantPanel
                  variant={variant}
                  productType={productType}
                  mode={mode}
                  masterPixelWidth={masterPixelWidth}
                  masterPixelHeight={masterPixelHeight}
                  masterFilename={masterFilename}
                  previewUrl={
                    images.find((image) => image.is_primary)?.image_url || images[0]?.image_url || null
                  }
                  activeVariantTemplates={activeVariantTemplates}
                  creatingTestOrderVariantId={creatingTestOrderVariantId}
                  creatingStudioOrderVariantId={creatingStudioOrderVariantId}
                  preparingPrintVariantId={preparingPrintVariantId}
                  printPrepareMessage={variant.id ? printPrepareMessages[variant.id] ?? null : null}
                  onChange={(next) =>
                    setVariants((current) => current.map((row, i) => (i === index ? next : row)))
                  }
                  onApplyTemplate={(template) =>
                    setVariants((current) =>
                      current.map((row, i) =>
                        i === index
                          ? applyTemplateToVariant(row, template, masterPixelWidth, masterPixelHeight)
                          : row,
                      ),
                    )
                  }
                  onCreateTestOrder={() => createTestOrder(variant)}
                  onCreateStudioOrder={() => void openStudioOrderDialog(variant)}
                  onPreparePrintFile={() => void preparePrintFile(variant)}
                  onDownloadPrintFile={() => downloadPrintFile(variant)}
                />
              </div>
            </details>
            );
          })}
          </div>
        </details>

        <section className={styles.panel}>
          <div className={styles.rowTop}>
            <h2>Images</h2>
            <button
              className={styles.btnSecondary}
              type="button"
              onClick={() => setImages((current) => [...current, createBlankImage()])}
            >
              Add Image
            </button>
          </div>
          <p>Image upload is out of scope for now. Enter image URLs directly.</p>

          {images.map((image, index) => (
            <div key={`${image.id ?? "img-new"}-${index}`} className={styles.row}>
              <div className={styles.rowTop}>
                <strong>Image {index + 1}</strong>
                <button
                  className={styles.btnSecondary}
                  type="button"
                  onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
                >
                  Delete
                </button>
              </div>
              <div className={styles.grid}>
                <label className={styles.span2}>
                  Image URL
                  <input
                    value={image.image_url}
                    onChange={(event) =>
                      setImages((current) =>
                        current.map((row, i) => (i === index ? { ...row, image_url: event.target.value } : row)),
                      )
                    }
                  />
                </label>
                <label>
                  Alt text
                  <input
                    value={image.alt_text}
                    onChange={(event) =>
                      setImages((current) =>
                        current.map((row, i) => (i === index ? { ...row, alt_text: event.target.value } : row)),
                      )
                    }
                  />
                </label>
                <label>
                  Sort order
                  <input
                    type="number"
                    value={image.sort_order}
                    onChange={(event) =>
                      setImages((current) =>
                        current.map((row, i) => (i === index ? { ...row, sort_order: event.target.value } : row)),
                      )
                    }
                  />
                </label>
                <div className={styles.checkCell}>
                  <label>
                    <input
                      type="radio"
                      checked={image.is_primary}
                      onChange={() => setPrimaryImage(index)}
                    />
                    Primary image
                  </label>
                </div>
              </div>
            </div>
          ))}
        </section>

        {mode === "edit" ? (
          <ProductWallQrCodes
            slug={slug}
            title={title}
            productId={initialData?.id}
            variants={variants
              .filter((variant) => variant.id && variant.is_active)
              .map((variant) => ({
                id: variant.id!,
                label: variant.variant_label.trim() || "Untitled variant",
              }))}
          />
        ) : null}

        {error ? <p className={styles.error}>{error}</p> : null}
        {testOrderMessage ? <p className={styles.success}>{testOrderMessage}</p> : null}

        <div className={styles.footerActions}>
          {saveActions}
          {mode === "edit" ? (
            <button className={styles.btnDanger} type="button" onClick={handleDeleteOrArchive} disabled={deleting || saving}>
              {deleting ? "Archiving..." : "Archive / Delete Product"}
            </button>
          ) : null}
        </div>
      </div>
      <ProductAudioCaptureModal
        open={audioCaptureOpen}
        slug={slug}
        title={title}
        currentProductId={initialData?.id ?? null}
        onClose={() => setAudioCaptureOpen(false)}
        onApplied={(fields) => {
          setAudioUrl(fields.audioUrl);
          setAudioDuration(fields.audioDuration);
          setAudioTranscript(fields.audioTranscript);
        }}
      />
      <StudioOrderDestinationDialog
        open={Boolean(studioOrderDialog)}
        title="Order for studio"
        description={`No payment and no edition number. Add "${studioOrderDialog?.variant.variant_label ?? "this print"}" to an open studio order, or start a new one.`}
        orders={studioOrderDialog?.orders ?? []}
        confirmLabel="Create"
        askQuantity
        busy={Boolean(creatingStudioOrderVariantId)}
        onCancel={() => {
          if (!creatingStudioOrderVariantId) setStudioOrderDialog(null);
        }}
        onConfirm={(orderId, quantity) => {
          if (studioOrderDialog) void createStudioOrder(studioOrderDialog.variant, orderId, quantity);
        }}
      />
    </div>
  );
}
