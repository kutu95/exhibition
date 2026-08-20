import { PIXEL_PERFECT_SQ_IN_RATES_AUD } from "./print-catalogue";
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

export type OfferSizeId = "small" | "medium" | "large";
export type OfferFinishId = "archival_matte" | "rth_canvas";
export type OfferPresentationId = "unframed" | "framed";

export const OFFER_MATTE_PAPER_LABEL = "Hahnemühle Photo Rag 308gsm";
export const OFFER_CANVAS_PAPER_LABEL = "Canson PhotoArt Canvas";
export const OFFER_MATTE_RATE_PER_SQ_IN = PIXEL_PERFECT_SQ_IN_RATES_AUD.standard_inkjet;
export const OFFER_FRAME_TYPE = "standard_perspex";

export const OFFER_FINISH_LABEL: Record<OfferFinishId, string> = {
  archival_matte: "Archival matte",
  rth_canvas: "Ready-to-hang canvas",
};

export const OFFER_SIZE_LABEL: Record<OfferSizeId, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export const OFFER_PRESENTATION_LABEL: Record<OfferPresentationId, string> = {
  unframed: "Unframed",
  framed: "Standard frame",
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

export type OfferCombo = {
  sizeId: OfferSizeId;
  finishId: OfferFinishId;
  /** Only meaningful for archival_matte; canvas is always unframed. */
  presentationId: OfferPresentationId;
};

/** Full 9-SKU matrix: 3 sizes × (matte unframed + matte framed + canvas). */
export const OFFER_COMBOS: OfferCombo[] = OFFER_SIZES.flatMap((size) => [
  { sizeId: size.id, finishId: "archival_matte", presentationId: "unframed" },
  { sizeId: size.id, finishId: "archival_matte", presentationId: "framed" },
  { sizeId: size.id, finishId: "rth_canvas", presentationId: "unframed" },
]);

export const offerComboKey = (combo: OfferCombo): string =>
  `${combo.sizeId}:${combo.finishId}:${combo.presentationId}`;

export const isOfferComboEqual = (a: OfferCombo, b: OfferCombo): boolean =>
  a.sizeId === b.sizeId && a.finishId === b.finishId && a.presentationId === b.presentationId;

export const findOfferCombo = (combo: OfferCombo): OfferCombo | null =>
  OFFER_COMBOS.find((row) => isOfferComboEqual(row, combo)) ?? null;

/** Selected SKUs at product create time. `price_aud` is an optional retail override in cents. */
export type OfferSelectionItem = OfferCombo & {
  price_aud?: number;
};

export const formatOfferVariantLabel = (combo: OfferCombo): string => {
  const size = OFFER_SIZE_LABEL[combo.sizeId];
  const finish = OFFER_FINISH_LABEL[combo.finishId];
  if (combo.finishId === "rth_canvas") {
    return `${size} · ${finish}`;
  }
  return `${size} · ${finish} · ${OFFER_PRESENTATION_LABEL[combo.presentationId]}`;
};

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
  finishId: OfferFinishId;
  presentationId: OfferPresentationId;
  mediaMarkupFactor: number;
  mediaBasePriceAud: number;
  frameMarkupFactor: number;
  frameBasePriceAud: number;
  frameRates?: FrameRateBand[];
  rthCanvasRates?: RthCanvasRateBand[];
  matteRatePerSqIn?: number;
}): OfferVariantPricing | null => {
  const frameRates = args.frameRates ?? SEED_FRAME_RATES;
  const rthRates = args.rthCanvasRates ?? SEED_RTH_CANVAS_RATES;
  const matteRate = args.matteRatePerSqIn ?? OFFER_MATTE_RATE_PER_SQ_IN;

  if (args.finishId === "rth_canvas") {
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

  const areaSqIn = mmToInches(args.widthMm) * mmToInches(args.heightMm);
  const mediaLabAud = Math.round(areaSqIn * matteRate * 100) / 100;
  const mediaRetailAud = computeRetailFromLabCost(
    mediaLabAud,
    args.mediaMarkupFactor,
    args.mediaBasePriceAud,
  );

  let frameLabAud = 0;
  let frameRetailAud = 0;
  if (args.presentationId === "framed") {
    const frame = computeFrameRetailAud({
      widthMm: args.widthMm,
      heightMm: args.heightMm,
      frameRates,
      markupFactor: args.frameMarkupFactor,
      basePriceAud: args.frameBasePriceAud,
    });
    if (!frame) return null;
    frameLabAud = frame.labCostAud;
    frameRetailAud = frame.retailAud;
  }

  const labCostAud = Math.round((mediaLabAud + frameLabAud) * 100) / 100;
  const retailAud = Math.round((mediaRetailAud + frameRetailAud) * 100) / 100;

  return {
    labCostAud,
    labCostCents: Math.round(labCostAud * 100),
    retailAud,
    retailCents: Math.round(retailAud * 100),
    mediaLabAud,
    frameLabAud,
    mediaRetailAud,
    frameRetailAud,
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
  print_type: "fine_art" | "canvas";
  price_aud: number;
  lab_cost_aud: number;
  edition_size: number;
  tier_label: string;
  finish: string;
  is_framed: boolean;
  frame_type: string | null;
  print_dpi: number;
  fulfilment_notes: string;
  fit_mode: "custom_size";
  crop_offset: number;
  size_lock: "long_edge";
  long_edge_mm: number;
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
}): OfferVariantDraft[] => {
  if (args.pixelWidth <= 0 || args.pixelHeight <= 0) {
    throw new Error("Pixel dimensions must be positive.");
  }

  const drafts: OfferVariantDraft[] = [];

  for (const combo of OFFER_COMBOS) {
    const sizeDef = OFFER_SIZES.find((s) => s.id === combo.sizeId)!;
    const size = deriveAspectPreservingSizeMm(sizeDef.longEdgeMm, args.pixelWidth, args.pixelHeight);
    const pricing = computeOfferVariantPricing({
      widthMm: size.width_mm,
      heightMm: size.height_mm,
      finishId: combo.finishId,
      presentationId: combo.presentationId,
      mediaMarkupFactor: args.mediaMarkupFactor,
      mediaBasePriceAud: args.mediaBasePriceAud,
      frameMarkupFactor: args.frameMarkupFactor,
      frameBasePriceAud: args.frameBasePriceAud,
      frameRates: args.frameRates,
      rthCanvasRates: args.rthCanvasRates,
    });

    if (!pricing) {
      continue;
    }

    const isCanvas = combo.finishId === "rth_canvas";
    const isFramed = combo.finishId === "archival_matte" && combo.presentationId === "framed";
    const paper = isCanvas ? OFFER_CANVAS_PAPER_LABEL : OFFER_MATTE_PAPER_LABEL;
    const fulfilmentNotes = [
      `Offer ${formatOfferVariantLabel(combo)}.`,
      `Custom size ${size.width_mm}x${size.height_mm}mm (lock long_edge ${sizeDef.longEdgeMm}mm).`,
      isCanvas
        ? "Order as ready-to-hang canvas package at Pixel Perfect."
        : isFramed
          ? "Order print + Standard frame with Perspex (do not use glass for shipping)."
          : "Order as custom paper at Pixel Perfect.",
    ].join(" ");

    drafts.push({
      combo,
      variant_label: formatOfferVariantLabel(combo),
      width_mm: size.width_mm,
      height_mm: size.height_mm,
      aspect_ratio: size.aspect_ratio,
      border_mm: 0,
      paper_type: paper,
      print_type: isCanvas ? "canvas" : "fine_art",
      price_aud: pricing.retailCents,
      lab_cost_aud: pricing.labCostCents,
      edition_size: args.editionSize,
      tier_label: OFFER_SIZE_LABEL[combo.sizeId],
      finish: OFFER_FINISH_LABEL[combo.finishId],
      is_framed: isFramed,
      frame_type: isFramed ? OFFER_FRAME_TYPE : null,
      print_dpi: 300,
      fulfilment_notes: fulfilmentNotes,
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

/** Match an active variant to offer axes (for storefront chooser). */
export const parseOfferAxesFromVariant = (variant: {
  tier_label?: string | null;
  finish?: string | null;
  is_framed?: boolean | null;
  variant_label?: string | null;
}): OfferCombo | null => {
  const label = (variant.variant_label ?? "").toLowerCase();
  const tier = (variant.tier_label ?? "").toLowerCase();
  const finishRaw = (variant.finish ?? "").toLowerCase();

  let sizeId: OfferSizeId | null = null;
  for (const size of OFFER_SIZES) {
    if (tier === size.label.toLowerCase() || label.startsWith(`${size.label.toLowerCase()} ·`)) {
      sizeId = size.id;
      break;
    }
  }
  if (!sizeId) return null;

  if (finishRaw.includes("canvas") || label.includes("ready-to-hang canvas")) {
    return { sizeId, finishId: "rth_canvas", presentationId: "unframed" };
  }

  const framed =
    Boolean(variant.is_framed) ||
    /\bframed\b/i.test(variant.variant_label ?? "") ||
    /\bstandard frame\b/i.test(variant.variant_label ?? "");
  return {
    sizeId,
    finishId: "archival_matte",
    presentationId: framed ? "framed" : "unframed",
  };
};

export const findVariantForOfferCombo = <T extends {
  id: string;
  is_active?: boolean | null;
  tier_label?: string | null;
  finish?: string | null;
  is_framed?: boolean | null;
  variant_label?: string | null;
}>(
  variants: T[],
  combo: OfferCombo,
): T | null => {
  const active = variants.filter((v) => v.is_active !== false);
  for (const variant of active) {
    const axes = parseOfferAxesFromVariant(variant);
    if (
      axes &&
      axes.sizeId === combo.sizeId &&
      axes.finishId === combo.finishId &&
      axes.presentationId === combo.presentationId
    ) {
      return variant;
    }
  }
  return null;
};
