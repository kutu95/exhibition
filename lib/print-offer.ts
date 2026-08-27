import {
  BLUE_WREN_CANVAS_LABEL,
  BLUE_WREN_MOUNT_LAB_MULTIPLIER,
  BLUE_WREN_RAG_CANVAS_RATE_PER_SQ_IN,
  BLUE_WREN_RAG_PHOTOGRAPHIQUE_LABEL,
  BLUE_WREN_SMOOTH_PEARL_LABEL,
  BLUE_WREN_SMOOTH_PEARL_RATE_PER_SQ_IN,
} from "./bluewren";
import type { FulfilmentClass, FulfilmentProvider } from "./fulfilment";
import {
  computeFrameRetailAud,
  computeRthCanvasRetailAud,
  type FrameRateBand,
  type RthCanvasRateBand,
  SEED_FRAME_RATES,
  SEED_RTH_CANVAS_RATES,
} from "./print-frame-pricing";
import {
  computeRetailFromLabCost,
  deriveAspectPreservingSizeMm,
  mmToInches,
} from "./print-size";
import {
  SEED_POSTERFACTORY_CATALOGUE,
  type PosterFactoryCatalogue,
} from "./posterfactory";

export type OfferSizeId = "a4" | "a3" | "a2" | "a0";
export type OfferClassId = "photographic" | "fine_art" | "framed" | "canvas";

export const OFFER_PHOTOGRAPHIC_PAPER_LABEL = BLUE_WREN_SMOOTH_PEARL_LABEL;
export const OFFER_FINE_ART_PAPER_LABEL = BLUE_WREN_RAG_PHOTOGRAPHIQUE_LABEL;
export const OFFER_CANVAS_PAPER_LABEL = BLUE_WREN_CANVAS_LABEL;
/** @deprecated Use OFFER_FINE_ART_PAPER_LABEL. Legacy matte paper kept for historical variants. */
export const OFFER_MATTE_PAPER_LABEL = "Hahnemühle Photo Rag 308gsm";
/** Blue Wren Smooth Pearl rate ($128/m²). */
export const OFFER_PHOTOGRAPHIC_RATE_PER_SQ_IN = BLUE_WREN_SMOOTH_PEARL_RATE_PER_SQ_IN;
/** Blue Wren Rag Photographique / canvas sheet rate ($200/m²). */
export const OFFER_FINE_ART_RATE_PER_SQ_IN = BLUE_WREN_RAG_CANVAS_RATE_PER_SQ_IN;
/**
 * Mountboard presentation: lab cost = Blue Wren print cost × this multiplier
 * (print + mount charged as 2× the paper rate until Blue Wren quotes mounts separately).
 */
export const OFFER_MOUNT_LAB_MULTIPLIER = BLUE_WREN_MOUNT_LAB_MULTIPLIER;
export const OFFER_FRAME_TYPE_POSTERFACTORY = "photo_frame_opti_shield";
export const OFFER_FRAME_TYPE_PIXEL_PERFECT = "standard_perspex";

export const OFFER_CLASS_LABEL: Record<OfferClassId, string> = {
  photographic: "Tier 1",
  fine_art: "Tier 2",
  framed: "Framed Print",
  canvas: "Canvas",
};

export const OFFER_CLASS_SUMMARY: Record<OfferClassId, string> = {
  photographic: "Ilford Galerie Smooth Pearl — best-value photographic print.",
  fine_art: "Canson Rag Photographique — premium archival fine-art print.",
  framed: "Ready-to-hang framed Tier 1 print (Ilford Galerie Smooth Pearl).",
  canvas: "Canson Photoart Pro Canvas — not Tier 1 or Tier 2; sheet or image wrap.",
};

export const OFFER_CLASS_DETAILS: Record<OfferClassId, string> = {
  photographic:
    "Tier 1 print on Ilford Galerie Smooth Pearl — excellent colour, detail and reduced glare.",
  fine_art:
    "Tier 2 print on Canson Rag Photographique — premium archival cotton rag.",
  framed:
    "Framed Tier 1 print on Ilford Galerie Smooth Pearl. Frame cost uses the existing frame calculator until Blue Wren mouldings are quoted.",
  canvas:
    "Canvas is separate from Tier 1 / Tier 2. Canson Photoart Pro Canvas as a flat sheet or image-wrapped.",
};

/** Paper quality tier for shop media. Canvas is intentionally un-tiered. */
export const offerPaperTier = (classId: OfferClassId): 1 | 2 | null => {
  if (classId === "photographic" || classId === "framed") return 1;
  if (classId === "fine_art") return 2;
  return null;
};

/** Blue Wren print lab cost for a media rate (AUD, 2 dp). */
export const blueWrenPrintLabAud = (widthMm: number, heightMm: number, ratePerSqIn: number): number => {
  const areaSqIn = mmToInches(widthMm) * mmToInches(heightMm);
  return Math.round(areaSqIn * ratePerSqIn * 100) / 100;
};

/** Mounted print lab = Blue Wren print cost × {@link OFFER_MOUNT_LAB_MULTIPLIER}. */
export const blueWrenMountedLabAud = (printLabAud: number): number =>
  Math.round(printLabAud * OFFER_MOUNT_LAB_MULTIPLIER * 100) / 100;

export const OFFER_CLASS_PROVIDER: Record<OfferClassId, FulfilmentProvider> = {
  photographic: "posterfactory",
  fine_art: "pixelperfect",
  framed: "posterfactory",
  canvas: "pixelperfect",
};

export const OFFER_CLASS_FULFILMENT: Record<OfferClassId, FulfilmentClass> = {
  photographic: "standard",
  fine_art: "fine_art",
  framed: "framed",
  canvas: "canvas",
};

export const OFFER_SIZE_LABEL: Record<OfferSizeId, string> = {
  a4: "A4",
  a3: "A3",
  a2: "A2",
  a0: "A0",
};

export type OfferSizeDef = {
  id: OfferSizeId;
  label: string;
  longEdgeMm: number;
};

/** Fixed shop sizes by long edge (aspect-preserving). Canvas is not in this matrix. */
export const OFFER_SIZES: OfferSizeDef[] = [
  { id: "a4", label: OFFER_SIZE_LABEL.a4, longEdgeMm: 297 },
  { id: "a3", label: OFFER_SIZE_LABEL.a3, longEdgeMm: 420 },
  { id: "a2", label: OFFER_SIZE_LABEL.a2, longEdgeMm: 594 },
  { id: "a0", label: OFFER_SIZE_LABEL.a0, longEdgeMm: 1189 },
];

export const OFFER_CLASSES: OfferClassId[] = ["photographic", "fine_art", "framed"];

export type OfferCombo = {
  sizeId: OfferSizeId;
  classId: OfferClassId;
};

/** 12-SKU matrix: A4/A3/A2/A0 × Tier 1 / Tier 2 / Framed. Canvas is custom-only. */
export const OFFER_COMBOS: OfferCombo[] = OFFER_SIZES.flatMap((size) =>
  OFFER_CLASSES.map((classId) => ({ sizeId: size.id, classId })),
);

export const offerComboKey = (combo: OfferCombo): string => `${combo.sizeId}:${combo.classId}`;

export const isOfferComboEqual = (a: OfferCombo, b: OfferCombo): boolean =>
  a.sizeId === b.sizeId && a.classId === b.classId;

export const findOfferCombo = (combo: OfferCombo): OfferCombo | null =>
  OFFER_COMBOS.find((row) => isOfferComboEqual(row, combo)) ?? null;

/** Selected SKUs at product create time. `price_aud` is an optional retail override in cents. */
export type OfferSelectionItem = OfferCombo & {
  price_aud?: number;
};

export const formatOfferVariantLabel = (combo: OfferCombo): string =>
  `${OFFER_SIZE_LABEL[combo.sizeId]} · ${OFFER_CLASS_LABEL[combo.classId]}`;

export type OfferVariantPricing = {
  labCostAud: number;
  labCostCents: number;
  retailAud: number;
  retailCents: number;
  mediaLabAud: number;
  frameLabAud: number;
  mediaRetailAud: number;
  frameRetailAud: number;
};

export const computeOfferVariantPricing = (args: {
  widthMm: number;
  heightMm: number;
  classId: OfferClassId;
  sizeId?: OfferSizeId;
  mediaMarkupFactor: number;
  mediaBasePriceAud: number;
  frameMarkupFactor: number;
  frameBasePriceAud: number;
  frameRates?: FrameRateBand[];
  rthCanvasRates?: RthCanvasRateBand[];
  photographicRatePerSqIn?: number;
  fineArtRatePerSqIn?: number;
  posterfactory?: PosterFactoryCatalogue;
}): OfferVariantPricing | null => {
  const rthRates = args.rthCanvasRates ?? SEED_RTH_CANVAS_RATES;
  const photographicRate = args.photographicRatePerSqIn ?? OFFER_PHOTOGRAPHIC_RATE_PER_SQ_IN;
  const fineArtRate = args.fineArtRatePerSqIn ?? OFFER_FINE_ART_RATE_PER_SQ_IN;

  if (args.classId === "canvas") {
    const rth = computeRthCanvasRetailAud({
      widthMm: args.widthMm,
      heightMm: args.heightMm,
      rthRates,
      markupFactor: args.mediaMarkupFactor,
      basePriceAud: args.mediaBasePriceAud,
    });
    if (!rth) return null;
    return {
      labCostAud: rth.labCostAud,
      labCostCents: Math.round(rth.labCostAud * 100),
      retailAud: rth.retailAud,
      retailCents: Math.round(rth.retailAud * 100),
      mediaLabAud: rth.labCostAud,
      frameLabAud: 0,
      mediaRetailAud: rth.retailAud,
      frameRetailAud: 0,
    };
  }

  if (args.classId === "framed") {
    const frameRates = args.frameRates ?? SEED_FRAME_RATES;
    const mediaLabAud = blueWrenPrintLabAud(args.widthMm, args.heightMm, photographicRate);
    const mediaRetailAud = computeRetailFromLabCost(
      mediaLabAud,
      args.mediaMarkupFactor,
      args.mediaBasePriceAud,
    );
    const frame = computeFrameRetailAud({
      widthMm: args.widthMm,
      heightMm: args.heightMm,
      frameRates,
      markupFactor: args.frameMarkupFactor,
      basePriceAud: args.frameBasePriceAud,
    });
    if (!frame) return null;
    const labCostAud = Math.round((mediaLabAud + frame.labCostAud) * 100) / 100;
    const retailAud = Math.round((mediaRetailAud + frame.retailAud) * 100) / 100;
    return {
      labCostAud,
      labCostCents: Math.round(labCostAud * 100),
      retailAud,
      retailCents: Math.round(retailAud * 100),
      mediaLabAud,
      frameLabAud: frame.labCostAud,
      mediaRetailAud,
      frameRetailAud: frame.retailAud,
    };
  }

  const rate = args.classId === "photographic" ? photographicRate : fineArtRate;
  const mediaLabAud = blueWrenPrintLabAud(args.widthMm, args.heightMm, rate);
  const mediaRetailAud = computeRetailFromLabCost(
    mediaLabAud,
    args.mediaMarkupFactor,
    args.mediaBasePriceAud,
  );

  return {
    labCostAud: mediaLabAud,
    labCostCents: Math.round(mediaLabAud * 100),
    retailAud: mediaRetailAud,
    retailCents: Math.round(mediaRetailAud * 100),
    mediaLabAud,
    frameLabAud: 0,
    mediaRetailAud,
    frameRetailAud: 0,
  };
};

export type OfferVariantDraft = {
  combo: OfferCombo;
  variant_label: string;
  width_mm: number;
  height_mm: number;
  aspect_ratio: string | null;
  border_mm: number;
  paper_type: string;
  print_type: "fine_art" | "photo" | "canvas";
  price_aud: number;
  lab_cost_aud: number;
  edition_size: number;
  tier_label: string;
  finish: string;
  is_framed: boolean;
  frame_type: string | null;
  print_dpi: number;
  fulfilment_notes: string;
  fulfilment_provider: FulfilmentProvider;
  fulfilment_class: FulfilmentClass;
  supplier_product_code: string | null;
  shipping_class: string;
  fit_mode: "custom_size";
  crop_offset: number;
  size_lock: "long_edge";
  long_edge_mm: number;
};

const paperForClass = (classId: OfferClassId, catalogue: PosterFactoryCatalogue): string => {
  if (classId === "photographic") return catalogue.photographic.paper;
  if (classId === "framed") return catalogue.framed.paper;
  if (classId === "canvas") return OFFER_CANVAS_PAPER_LABEL;
  return OFFER_FINE_ART_PAPER_LABEL;
};

const printTypeForClass = (classId: OfferClassId): "fine_art" | "photo" | "canvas" => {
  if (classId === "canvas") return "canvas";
  if (classId === "fine_art") return "fine_art";
  return "photo";
};

const supplierCodeForClass = (classId: OfferClassId, catalogue: PosterFactoryCatalogue): string | null => {
  if (classId === "photographic") return catalogue.photographic.productCode;
  if (classId === "framed") return catalogue.framed.productCode;
  if (classId === "fine_art") return "canson-rag-photographique";
  return "canson-photoart-pro-canvas";
};

const fulfilmentNotesForClass = (combo: OfferCombo, widthMm: number, heightMm: number, longEdgeMm: number): string => {
  const label = formatOfferVariantLabel(combo);
  const sizeNote = `Custom size ${widthMm}x${heightMm}mm (lock long_edge ${longEdgeMm}mm).`;
  if (combo.classId === "photographic") {
    return `${label}. ${sizeNote} Print on ${OFFER_PHOTOGRAPHIC_PAPER_LABEL} (Blue Wren).`;
  }
  if (combo.classId === "framed") {
    return `${label}. ${sizeNote} Print on ${OFFER_PHOTOGRAPHIC_PAPER_LABEL}; frame cost from existing frame calculator until Blue Wren mouldings quoted.`;
  }
  if (combo.classId === "canvas") {
    return `${label}. ${sizeNote} ${OFFER_CANVAS_PAPER_LABEL} — confirm sheet vs image wrap with Blue Wren.`;
  }
  return `${label}. ${sizeNote} Print on ${OFFER_FINE_ART_PAPER_LABEL} (Blue Wren).`;
};

export const buildOfferVariantsForProduct = (args: {
  pixelWidth: number;
  pixelHeight: number;
  editionSize: number;
  mediaMarkupFactor: number;
  mediaBasePriceAud: number;
  frameMarkupFactor: number;
  frameBasePriceAud: number;
  frameRates?: FrameRateBand[];
  rthCanvasRates?: RthCanvasRateBand[];
  fineArtRatePerSqIn?: number;
  posterfactory?: PosterFactoryCatalogue;
}): OfferVariantDraft[] => {
  if (args.pixelWidth <= 0 || args.pixelHeight <= 0) {
    throw new Error("Pixel dimensions must be positive.");
  }

  const catalogue = args.posterfactory ?? SEED_POSTERFACTORY_CATALOGUE;
  const drafts: OfferVariantDraft[] = [];

  for (const combo of OFFER_COMBOS) {
    const sizeDef = OFFER_SIZES.find((s) => s.id === combo.sizeId)!;
    const size = deriveAspectPreservingSizeMm(sizeDef.longEdgeMm, args.pixelWidth, args.pixelHeight);
    const pricing = computeOfferVariantPricing({
      widthMm: size.width_mm,
      heightMm: size.height_mm,
      classId: combo.classId,
      sizeId: combo.sizeId,
      mediaMarkupFactor: args.mediaMarkupFactor,
      mediaBasePriceAud: args.mediaBasePriceAud,
      frameMarkupFactor: args.frameMarkupFactor,
      frameBasePriceAud: args.frameBasePriceAud,
      frameRates: args.frameRates,
      rthCanvasRates: args.rthCanvasRates,
      fineArtRatePerSqIn: args.fineArtRatePerSqIn,
      posterfactory: catalogue,
    });

    if (!pricing) {
      continue;
    }

    const isFramed = combo.classId === "framed";
    const provider = OFFER_CLASS_PROVIDER[combo.classId];

    drafts.push({
      combo,
      variant_label: formatOfferVariantLabel(combo),
      width_mm: size.width_mm,
      height_mm: size.height_mm,
      aspect_ratio: size.aspect_ratio,
      border_mm: 0,
      paper_type: paperForClass(combo.classId, catalogue),
      print_type: printTypeForClass(combo.classId),
      price_aud: pricing.retailCents,
      lab_cost_aud: pricing.labCostCents,
      edition_size: args.editionSize,
      tier_label: OFFER_SIZE_LABEL[combo.sizeId],
      finish: OFFER_CLASS_LABEL[combo.classId],
      is_framed: isFramed,
      frame_type: isFramed ? OFFER_FRAME_TYPE_PIXEL_PERFECT : null,
      print_dpi: 300,
      fulfilment_notes: fulfilmentNotesForClass(combo, size.width_mm, size.height_mm, sizeDef.longEdgeMm),
      fulfilment_provider: provider,
      fulfilment_class: OFFER_CLASS_FULFILMENT[combo.classId],
      supplier_product_code: supplierCodeForClass(combo.classId, catalogue),
      shipping_class: provider,
      fit_mode: "custom_size",
      crop_offset: 0,
      size_lock: "long_edge",
      long_edge_mm: sizeDef.longEdgeMm,
    });
  }

  if (drafts.length === 0) {
    throw new Error("NO_OFFER_PRICING");
  }

  return drafts;
};

export const applyOfferSelection = (
  drafts: OfferVariantDraft[],
  selection: OfferSelectionItem[] | null | undefined,
): OfferVariantDraft[] => {
  if (selection === null || selection === undefined) {
    return drafts;
  }
  if (selection.length === 0) {
    throw new Error("EMPTY_OFFER_SELECTION");
  }

  const byKey = new Map(drafts.map((draft) => [offerComboKey(draft.combo), draft]));
  return selection.map((item) => {
    const combo = findOfferCombo(item);
    if (!combo) {
      throw new Error("UNKNOWN_OFFER_COMBO");
    }
    const draft = byKey.get(offerComboKey(combo));
    if (!draft) {
      throw new Error("UNKNOWN_OFFER_COMBO");
    }
    if (item.price_aud === undefined) {
      return draft;
    }
    if (!Number.isInteger(item.price_aud) || item.price_aud < 0) {
      throw new Error("INVALID_OFFER_PRICE");
    }
    return { ...draft, price_aud: item.price_aud };
  });
};

const parseSizeId = (variant: {
  tier_label?: string | null;
  variant_label?: string | null;
}): OfferSizeId | null => {
  const label = (variant.variant_label ?? "").toLowerCase();
  const tier = (variant.tier_label ?? "").toLowerCase();
  for (const size of OFFER_SIZES) {
    if (tier === size.label.toLowerCase() || label.startsWith(`${size.label.toLowerCase()} ·`)) {
      return size.id;
    }
  }
  return null;
};

const classIdFromFulfilmentClass = (value: string | null | undefined): OfferClassId | null => {
  if (value === "standard") return "photographic";
  if (value === "fine_art") return "fine_art";
  if (value === "framed") return "framed";
  if (value === "canvas") return "canvas";
  return null;
};

/** Match an active variant to offer axes (for storefront chooser). */
export const parseOfferAxesFromVariant = (variant: {
  fulfilment_class?: string | null;
  tier_label?: string | null;
  finish?: string | null;
  is_framed?: boolean | null;
  variant_label?: string | null;
  print_type?: string | null;
}): OfferCombo | null => {
  const sizeId = parseSizeId(variant);
  if (!sizeId) return null;

  const label = (variant.variant_label ?? "").toLowerCase();
  const finishRaw = (variant.finish ?? "").toLowerCase();
  const printType = (variant.print_type ?? "").toLowerCase();
  const unframedLabel = /\bunframed\b/i.test(variant.variant_label ?? "");
  const canvasLike =
    finishRaw.includes("canvas") || label.includes("ready-to-hang canvas") || printType === "canvas";

  if (canvasLike) {
    return { sizeId, classId: "canvas" };
  }

  const fromClass = classIdFromFulfilmentClass(variant.fulfilment_class);
  if (fromClass === "canvas") {
    return { sizeId, classId: "canvas" };
  }
  if (unframedLabel && fromClass === "framed") {
    return { sizeId, classId: "fine_art" };
  }
  if (fromClass) {
    return { sizeId, classId: fromClass };
  }

  if (
    finishRaw.includes("tier 1") ||
    finishRaw.includes("photographic") ||
    label.includes("tier 1") ||
    label.includes("photographic print") ||
    (printType === "photo" && !Boolean(variant.is_framed) && !label.includes("canvas"))
  ) {
    if (Boolean(variant.is_framed) || /\bframed print\b/i.test(variant.variant_label ?? "")) {
      return { sizeId, classId: "framed" };
    }
    if (
      finishRaw.includes("tier 1") ||
      finishRaw.includes("photographic") ||
      label.includes("tier 1") ||
      label.includes("photographic print")
    ) {
      return { sizeId, classId: "photographic" };
    }
  }

  if (
    !unframedLabel &&
    (finishRaw.includes("framed print") ||
      label.includes("framed print") ||
      Boolean(variant.is_framed) ||
      /(^|[^n])framed\b/i.test(variant.variant_label ?? "") ||
      /\bstandard frame\b/i.test(variant.variant_label ?? ""))
  ) {
    return { sizeId, classId: "framed" };
  }

  if (
    finishRaw.includes("tier 2") ||
    finishRaw.includes("fine art") ||
    label.includes("tier 2") ||
    label.includes("fine art print") ||
    printType === "fine_art"
  ) {
    return { sizeId, classId: "fine_art" };
  }

  if (finishRaw.includes("archival matte") || label.includes("archival matte") || unframedLabel) {
    return { sizeId, classId: "fine_art" };
  }

  return null;
};

export const findVariantForOfferCombo = <
  T extends {
    id: string;
    is_active?: boolean | null;
    fulfilment_class?: string | null;
    tier_label?: string | null;
    finish?: string | null;
    is_framed?: boolean | null;
    variant_label?: string | null;
    print_type?: string | null;
  },
>(
  variants: T[],
  combo: OfferCombo,
): T | null => {
  const active = variants.filter((v) => v.is_active !== false);
  for (const variant of active) {
    const axes = parseOfferAxesFromVariant(variant);
    if (axes && axes.sizeId === combo.sizeId && axes.classId === combo.classId) {
      return variant;
    }
  }
  return null;
};

/** @deprecated Finish axis replaced by OfferClassId. Kept for older UI copy. */
export type OfferFinishId = "archival_matte" | "rth_canvas";
/** @deprecated Presentation is now the Framed Print class. */
export type OfferPresentationId = "unframed" | "framed";
export const OFFER_FINISH_LABEL: Record<OfferFinishId, string> = {
  archival_matte: "Archival matte",
  rth_canvas: "Ready-to-hang canvas",
};
export const OFFER_PRESENTATION_LABEL: Record<OfferPresentationId, string> = {
  unframed: "Unframed",
  framed: "Standard frame",
};
