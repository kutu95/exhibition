import { PIXEL_PERFECT_SQ_IN_RATES_AUD } from "./print-catalogue";
import type { FulfilmentClass, FulfilmentProvider } from "./fulfilment";
import {
  computeRthCanvasRetailAud,
  type FrameRateBand,
  type RthCanvasRateBand,
  SEED_RTH_CANVAS_RATES,
} from "./print-frame-pricing";
import {
  computeRetailFromLabCost,
  deriveAspectPreservingSizeMm,
  mmToInches,
} from "./print-size";
import {
  posterFactorySizePrice,
  SEED_POSTERFACTORY_CATALOGUE,
  type PosterFactoryCatalogue,
} from "./posterfactory";

export type OfferSizeId = "small" | "medium" | "large";
export type OfferClassId = "photographic" | "fine_art" | "framed" | "canvas";

export const OFFER_PHOTOGRAPHIC_PAPER_LABEL = "Ilford Smooth Pearl 310gsm";
export const OFFER_FINE_ART_PAPER_LABEL = "Hahnemühle Photo Rag Pearl";
export const OFFER_CANVAS_PAPER_LABEL = "Canson PhotoArt Canvas";
/** @deprecated Use OFFER_FINE_ART_PAPER_LABEL. Legacy matte paper kept for custom/admin lists. */
export const OFFER_MATTE_PAPER_LABEL = "Hahnemühle Photo Rag 308gsm";
export const OFFER_FINE_ART_RATE_PER_SQ_IN = PIXEL_PERFECT_SQ_IN_RATES_AUD.premium_inkjet;
export const OFFER_FRAME_TYPE_POSTERFACTORY = "photo_frame_opti_shield";
export const OFFER_FRAME_TYPE_PIXEL_PERFECT = "standard_perspex";

export const OFFER_CLASS_LABEL: Record<OfferClassId, string> = {
  photographic: "Photographic Print",
  fine_art: "Fine Art Print",
  framed: "Framed Print",
  canvas: "Ready-to-hang canvas",
};

export const OFFER_CLASS_SUMMARY: Record<OfferClassId, string> = {
  photographic: "Best-value professional photographic print.",
  fine_art: "Premium archival Hahnemühle fine-art print.",
  framed: "Ready-to-hang framed photographic print.",
  canvas: "Gallery-wrapped canvas, ready to hang.",
};

export const OFFER_CLASS_DETAILS: Record<OfferClassId, string> = {
  photographic:
    "Professional photographic print on heavyweight pearl-finish paper with excellent colour, detail and reduced glare. Printed on Ilford Smooth Pearl 310gsm.",
  fine_art: "Premium archival fine-art print on Hahnemühle Photo Rag Pearl.",
  framed:
    "Ready-to-hang framed photographic print on Ilford Smooth Pearl 310gsm, mounted and finished with 3mm Opti-shield glazing.",
  canvas: "Ready-to-hang gallery canvas on Canson PhotoArt Canvas.",
};

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
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export type OfferSizeDef = {
  id: OfferSizeId;
  label: string;
  longEdgeMm: number;
};

/** Fixed buyer sizes (A3 / A2 / A1 long-edge bands). */
export const OFFER_SIZES: OfferSizeDef[] = [
  { id: "small", label: OFFER_SIZE_LABEL.small, longEdgeMm: 420 },
  { id: "medium", label: OFFER_SIZE_LABEL.medium, longEdgeMm: 594 },
  { id: "large", label: OFFER_SIZE_LABEL.large, longEdgeMm: 841 },
];

export const OFFER_CLASSES: OfferClassId[] = ["photographic", "fine_art", "framed", "canvas"];

export type OfferCombo = {
  sizeId: OfferSizeId;
  classId: OfferClassId;
};

/** 12-SKU matrix: 3 sizes × Photographic / Fine Art / Framed / Canvas. */
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
  fineArtRatePerSqIn?: number;
  posterfactory?: PosterFactoryCatalogue;
}): OfferVariantPricing | null => {
  const rthRates = args.rthCanvasRates ?? SEED_RTH_CANVAS_RATES;
  const fineArtRate = args.fineArtRatePerSqIn ?? OFFER_FINE_ART_RATE_PER_SQ_IN;
  const posterfactory = args.posterfactory ?? SEED_POSTERFACTORY_CATALOGUE;

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

  if (args.classId === "photographic" || args.classId === "framed") {
    const sizeId = args.sizeId;
    if (!sizeId) return null;
    const pf = posterFactorySizePrice(posterfactory, args.classId, sizeId);
    if (!pf) return null;
    const labCostAud = pf.supplierCostAud;
    const retailAud =
      pf.retailPriceAud !== null
        ? pf.retailPriceAud
        : computeRetailFromLabCost(labCostAud, args.mediaMarkupFactor, args.mediaBasePriceAud);
    return {
      labCostAud,
      labCostCents: Math.round(labCostAud * 100),
      retailAud,
      retailCents: Math.round(retailAud * 100),
      mediaLabAud: labCostAud,
      frameLabAud: 0,
      mediaRetailAud: retailAud,
      frameRetailAud: 0,
    };
  }

  const areaSqIn = mmToInches(args.widthMm) * mmToInches(args.heightMm);
  const mediaLabAud = Math.round(areaSqIn * fineArtRate * 100) / 100;
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
  if (classId === "fine_art") return "hm-photo-rag-pearl";
  return "canson-photoart-canvas";
};

const fulfilmentNotesForClass = (combo: OfferCombo, widthMm: number, heightMm: number, longEdgeMm: number): string => {
  const label = formatOfferVariantLabel(combo);
  const sizeNote = `Custom size ${widthMm}x${heightMm}mm (lock long_edge ${longEdgeMm}mm).`;
  if (combo.classId === "photographic") {
    return `${label}. ${sizeNote} Fulfil via PosterFactory — ${OFFER_PHOTOGRAPHIC_PAPER_LABEL}.`;
  }
  if (combo.classId === "framed") {
    return `${label}. ${sizeNote} Fulfil via PosterFactory Photo+Frame with 3mm Opti-shield (do not use glass).`;
  }
  if (combo.classId === "canvas") {
    return `${label}. ${sizeNote} Order as ready-to-hang canvas package at Pixel Perfect.`;
  }
  return `${label}. ${sizeNote} Order as ${OFFER_FINE_ART_PAPER_LABEL} at Pixel Perfect.`;
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
      frame_type: isFramed ? OFFER_FRAME_TYPE_POSTERFACTORY : null,
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
    finishRaw.includes("photographic") ||
    label.includes("photographic print") ||
    (printType === "photo" && !Boolean(variant.is_framed) && !label.includes("canvas"))
  ) {
    if (Boolean(variant.is_framed) || /\bframed print\b/i.test(variant.variant_label ?? "")) {
      return { sizeId, classId: "framed" };
    }
    if (finishRaw.includes("photographic") || label.includes("photographic print")) {
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

  if (finishRaw.includes("fine art") || label.includes("fine art print") || printType === "fine_art") {
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
