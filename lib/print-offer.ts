import {
  BLUE_WREN_CANVAS_IMAGEWRAP_LABEL,
  BLUE_WREN_CANVAS_IMAGEWRAP_RATE_PER_SQ_IN,
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
  type FrameRateBand,
  type RthCanvasRateBand,
  SEED_FRAME_RATES,
} from "./print-frame-pricing";
import {
  computeRetailFromLabCost,
  deriveAspectPreservingSizeMm,
  mmToInches,
} from "./print-size";
import { PRINT_PRICE_PER_PRINT_AUD } from "./print-markup";
import {
  SEED_POSTERFACTORY_CATALOGUE,
  type PosterFactoryCatalogue,
} from "./posterfactory";

export type OfferSizeId = "a4" | "a3" | "a2" | "a0";
export type OfferClassId =
  | "photographic"
  | "photographic_mounted"
  | "fine_art"
  | "fine_art_mounted"
  | "framed"
  | "fine_art_framed"
  | "canvas"
  | "canvas_wrap";

/** Buyer-facing medium axis (substrate family). */
export type OfferMediaId = "tier1" | "tier2" | "canvas" | "canvas_wrap";
/** Buyer-facing finish axis (depends on medium). */
export type OfferPresentationId = "print" | "mounted" | "framed" | "wrap";

export const OFFER_PHOTOGRAPHIC_PAPER_LABEL = BLUE_WREN_SMOOTH_PEARL_LABEL;
export const OFFER_FINE_ART_PAPER_LABEL = BLUE_WREN_RAG_PHOTOGRAPHIQUE_LABEL;
export const OFFER_CANVAS_PAPER_LABEL = BLUE_WREN_CANVAS_LABEL;
export const OFFER_CANVAS_WRAP_PAPER_LABEL = BLUE_WREN_CANVAS_IMAGEWRAP_LABEL;
/** @deprecated Use OFFER_FINE_ART_PAPER_LABEL. Legacy matte paper kept for historical variants. */
export const OFFER_MATTE_PAPER_LABEL = "Hahnemühle Photo Rag 308gsm";
/** Blue Wren Smooth Pearl rate ($128/m²). */
export const OFFER_PHOTOGRAPHIC_RATE_PER_SQ_IN = BLUE_WREN_SMOOTH_PEARL_RATE_PER_SQ_IN;
/** Blue Wren Rag Photographique / canvas sheet rate ($200/m²). */
export const OFFER_FINE_ART_RATE_PER_SQ_IN = BLUE_WREN_RAG_CANVAS_RATE_PER_SQ_IN;
/** Blue Wren canvas + image wrap approximate $/in². */
export const OFFER_CANVAS_WRAP_RATE_PER_SQ_IN = BLUE_WREN_CANVAS_IMAGEWRAP_RATE_PER_SQ_IN;
/**
 * Mountboard presentation: lab cost = Blue Wren print cost × this multiplier
 * (print + mount charged as 2× the paper rate until Blue Wren quotes mounts separately).
 */
export const OFFER_MOUNT_LAB_MULTIPLIER = BLUE_WREN_MOUNT_LAB_MULTIPLIER;
export const OFFER_FRAME_TYPE_POSTERFACTORY = "photo_frame_opti_shield";
export const OFFER_FRAME_TYPE_PIXEL_PERFECT = "standard_perspex";

export const OFFER_CLASS_LABEL: Record<OfferClassId, string> = {
  photographic: "Tier 1",
  photographic_mounted: "Tier 1 · Mountboard",
  fine_art: "Tier 2",
  fine_art_mounted: "Tier 2 · Mountboard",
  framed: "Tier 1 · Framed",
  fine_art_framed: "Tier 2 · Framed",
  canvas: "Canvas",
  canvas_wrap: "Canvas · Image wrap",
};

export const OFFER_CLASS_SUMMARY: Record<OfferClassId, string> = {
  photographic: "Ilford Galerie Smooth Pearl — print only.",
  photographic_mounted: "Tier 1 print mounted on board.",
  fine_art: "Canson Rag Photographique — print only.",
  fine_art_mounted: "Tier 2 print mounted on board.",
  framed: "Ready-to-hang framed Tier 1 print.",
  fine_art_framed: "Ready-to-hang framed Tier 2 print.",
  canvas: "Canson Photoart Pro Canvas — flat sheet, no wrap.",
  canvas_wrap: "Canvas stretched with image wrap over the edges.",
};

export const OFFER_CLASS_DETAILS: Record<OfferClassId, string> = {
  photographic:
    "Tier 1 print on Ilford Galerie Smooth Pearl — excellent colour, detail and reduced glare.",
  photographic_mounted:
    "Tier 1 print on Ilford Galerie Smooth Pearl, mounted on board for a clean, ready-to-present finish.",
  fine_art:
    "Tier 2 print on Canson Rag Photographique — premium archival cotton rag.",
  fine_art_mounted:
    "Tier 2 print on Canson Rag Photographique, mounted on board for a clean, ready-to-present finish.",
  framed:
    "Framed Tier 1 print on Ilford Galerie Smooth Pearl — ready to hang.",
  fine_art_framed:
    "Framed Tier 2 print on Canson Rag Photographique — ready to hang.",
  canvas:
    "Canson Photoart Pro Canvas as a flat sheet (no stretcher / image wrap).",
  canvas_wrap:
    "Canson Photoart Pro Canvas with image wrap — print continues around the stretcher edges.",
};

/**
 * Buyer-facing paper axis for the storefront chooser. Canvas is a single paper
 * with two finishes (rolled / stretched) rather than two separate mediums, so
 * the chooser always presents the same three steps: size, paper, finish.
 */
export type OfferPaperId = "tier1" | "tier2" | "canvas";

export const OFFER_PAPER_IDS: OfferPaperId[] = ["tier1", "tier2", "canvas"];

export const OFFER_PAPER_LABEL: Record<OfferPaperId, string> = {
  tier1: "Photographic",
  tier2: "Fine art rag",
  canvas: "Canvas",
};

export const OFFER_PAPER_SUMMARY: Record<OfferPaperId, string> = {
  tier1: "Rich colour, low glare",
  tier2: "Matte, deepest blacks",
  canvas: "Woven texture, no glass",
};

export const OFFER_PAPER_DETAILS: Record<OfferPaperId, string> = {
  tier1: `${OFFER_PHOTOGRAPHIC_PAPER_LABEL} — a pearl-surface photographic paper with excellent colour and fine detail, and far less reflection than gloss.`,
  tier2: `${OFFER_FINE_ART_PAPER_LABEL} — 100% cotton rag with a matte surface, the deepest blacks and the longest archival life. The collector's choice.`,
  canvas: `${OFFER_CANVAS_PAPER_LABEL} — a woven canvas surface, supplied rolled in a tube or stretched over a timber frame with the image continuing around the edges.`,
};

/** Finishes available per paper. Every paper has at least two, so the step never disappears. */
export const OFFER_PAPER_PRESENTATIONS: Record<OfferPaperId, OfferPresentationId[]> = {
  tier1: ["print", "mounted", "framed"],
  tier2: ["print", "mounted", "framed"],
  canvas: ["print", "wrap"],
};

export const classIdFromPaperPresentation = (
  paper: OfferPaperId,
  presentation: OfferPresentationId,
): OfferClassId | null => {
  if (paper === "canvas") {
    if (presentation === "print") return "canvas";
    if (presentation === "wrap") return "canvas_wrap";
    return null;
  }
  return classIdFromMediaPresentation(paper, presentation);
};

export const paperPresentationFromClassId = (
  classId: OfferClassId,
): { paper: OfferPaperId; presentation: OfferPresentationId } => {
  const { media, presentation } = mediaPresentationFromClassId(classId);
  return { paper: media === "canvas_wrap" ? "canvas" : media, presentation };
};

/** Finish wording depends on the paper — "Print only" means nothing for canvas. */
export const offerPresentationLabel = (
  paper: OfferPaperId,
  presentation: OfferPresentationId,
): string => {
  if (paper === "canvas") return presentation === "wrap" ? "Stretched" : "Rolled";
  if (presentation === "mounted") return "Mounted";
  if (presentation === "framed") return "Framed";
  return "Print only";
};

export const offerPresentationSummary = (
  paper: OfferPaperId,
  presentation: OfferPresentationId,
): string => {
  if (paper === "canvas") {
    return presentation === "wrap"
      ? "On a timber frame, ready to hang"
      : "Rolled in a tube, ready to stretch";
  }
  if (presentation === "mounted") return "On backing board, ready to frame";
  if (presentation === "framed") return "Framed behind acrylic, ready to hang";
  return "Loose sheet, you arrange framing";
};

/**
 * Where each size belongs on a wall. `OFFER_SIZE_LABEL` stays the canonical
 * A-code written into variant labels; this is display only.
 */
export const OFFER_SIZE_HINT: Record<OfferSizeId, string> = {
  a4: "Desk or shelf",
  a3: "Small wall",
  a2: "Feature wall",
  a0: "Statement piece",
};

export const isFramedOfferClass = (classId: OfferClassId): boolean =>
  classId === "framed" || classId === "fine_art_framed";

export const classIdFromMediaPresentation = (
  media: OfferMediaId,
  presentation: OfferPresentationId,
): OfferClassId | null => {
  if (media === "tier1") {
    if (presentation === "print") return "photographic";
    if (presentation === "mounted") return "photographic_mounted";
    if (presentation === "framed") return "framed";
    return null;
  }
  if (media === "tier2") {
    if (presentation === "print") return "fine_art";
    if (presentation === "mounted") return "fine_art_mounted";
    if (presentation === "framed") return "fine_art_framed";
    return null;
  }
  if (media === "canvas") return "canvas";
  if (media === "canvas_wrap") return "canvas_wrap";
  return null;
};

export const mediaPresentationFromClassId = (
  classId: OfferClassId,
): { media: OfferMediaId; presentation: OfferPresentationId } => {
  switch (classId) {
    case "photographic":
      return { media: "tier1", presentation: "print" };
    case "photographic_mounted":
      return { media: "tier1", presentation: "mounted" };
    case "framed":
      return { media: "tier1", presentation: "framed" };
    case "fine_art":
      return { media: "tier2", presentation: "print" };
    case "fine_art_mounted":
      return { media: "tier2", presentation: "mounted" };
    case "fine_art_framed":
      return { media: "tier2", presentation: "framed" };
    case "canvas":
      return { media: "canvas", presentation: "print" };
    case "canvas_wrap":
      return { media: "canvas_wrap", presentation: "wrap" };
  }
};

/** Paper quality tier. Canvas is intentionally un-tiered. */
export const offerPaperTier = (classId: OfferClassId): 1 | 2 | null => {
  if (classId === "photographic" || classId === "photographic_mounted" || classId === "framed") return 1;
  if (classId === "fine_art" || classId === "fine_art_mounted" || classId === "fine_art_framed") return 2;
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
  photographic_mounted: "posterfactory",
  fine_art: "pixelperfect",
  fine_art_mounted: "pixelperfect",
  framed: "posterfactory",
  fine_art_framed: "pixelperfect",
  canvas: "pixelperfect",
  canvas_wrap: "pixelperfect",
};

export const OFFER_CLASS_FULFILMENT: Record<OfferClassId, FulfilmentClass> = {
  photographic: "standard",
  photographic_mounted: "standard",
  fine_art: "fine_art",
  fine_art_mounted: "fine_art",
  framed: "framed",
  fine_art_framed: "framed",
  canvas: "canvas",
  canvas_wrap: "canvas",
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

/** Fixed shop sizes by long edge (aspect-preserving). */
export const OFFER_SIZES: OfferSizeDef[] = [
  { id: "a4", label: OFFER_SIZE_LABEL.a4, longEdgeMm: 297 },
  { id: "a3", label: OFFER_SIZE_LABEL.a3, longEdgeMm: 420 },
  { id: "a2", label: OFFER_SIZE_LABEL.a2, longEdgeMm: 594 },
  { id: "a0", label: OFFER_SIZE_LABEL.a0, longEdgeMm: 1189 },
];

export const OFFER_CLASSES: OfferClassId[] = [
  "photographic",
  "photographic_mounted",
  "fine_art",
  "fine_art_mounted",
  "framed",
  "fine_art_framed",
  "canvas",
  "canvas_wrap",
];

export type OfferCombo = {
  sizeId: OfferSizeId;
  classId: OfferClassId;
};

/** 32-SKU matrix: A4/A3/A2/A0 × 8 media/finish options. */
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

export const parseOfferSelectionPayload = (value: unknown): OfferSelectionItem[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("EMPTY_OFFER_SELECTION");
  }

  return value.map((row) => {
    if (!row || typeof row !== "object") {
      throw new Error("INVALID_OFFER_SELECTION");
    }
    const record = row as Record<string, unknown>;
    const sizeId = record.sizeId;
    const classId = record.classId;
    if (typeof sizeId !== "string" || typeof classId !== "string") {
      throw new Error("INVALID_OFFER_SELECTION");
    }
    const combo = findOfferCombo({ sizeId: sizeId as OfferSizeId, classId: classId as OfferClassId });
    if (!combo) {
      throw new Error("UNKNOWN_OFFER_COMBO");
    }
    if (record.price_aud === undefined) {
      return { ...combo };
    }
    if (typeof record.price_aud !== "number" || !Number.isInteger(record.price_aud) || record.price_aud < 0) {
      throw new Error("INVALID_OFFER_PRICE");
    }
    return { ...combo, price_aud: record.price_aud };
  });
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
  canvasWrapRatePerSqIn?: number;
  posterfactory?: PosterFactoryCatalogue;
}): OfferVariantPricing | null => {
  const photographicRate = args.photographicRatePerSqIn ?? OFFER_PHOTOGRAPHIC_RATE_PER_SQ_IN;
  const fineArtRate = args.fineArtRatePerSqIn ?? OFFER_FINE_ART_RATE_PER_SQ_IN;
  const canvasWrapRate = args.canvasWrapRatePerSqIn ?? OFFER_CANVAS_WRAP_RATE_PER_SQ_IN;

  const pricedFromLab = (mediaLabAud: number): OfferVariantPricing => {
    const mediaRetailAud =
      computeRetailFromLabCost(
        mediaLabAud,
        args.mediaMarkupFactor,
        args.mediaBasePriceAud,
      ) + PRINT_PRICE_PER_PRINT_AUD;
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

  if (args.classId === "framed" || args.classId === "fine_art_framed") {
    const frameRates = args.frameRates ?? SEED_FRAME_RATES;
    const mediaRate = args.classId === "fine_art_framed" ? fineArtRate : photographicRate;
    const mediaLabAud = blueWrenPrintLabAud(args.widthMm, args.heightMm, mediaRate);
    const mediaRetailAud =
      computeRetailFromLabCost(
        mediaLabAud,
        args.mediaMarkupFactor,
        args.mediaBasePriceAud,
      ) + PRINT_PRICE_PER_PRINT_AUD;
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

  if (args.classId === "photographic") {
    return pricedFromLab(blueWrenPrintLabAud(args.widthMm, args.heightMm, photographicRate));
  }
  if (args.classId === "photographic_mounted") {
    return pricedFromLab(
      blueWrenMountedLabAud(blueWrenPrintLabAud(args.widthMm, args.heightMm, photographicRate)),
    );
  }
  if (args.classId === "fine_art") {
    return pricedFromLab(blueWrenPrintLabAud(args.widthMm, args.heightMm, fineArtRate));
  }
  if (args.classId === "fine_art_mounted") {
    return pricedFromLab(
      blueWrenMountedLabAud(blueWrenPrintLabAud(args.widthMm, args.heightMm, fineArtRate)),
    );
  }
  if (args.classId === "canvas") {
    return pricedFromLab(blueWrenPrintLabAud(args.widthMm, args.heightMm, fineArtRate));
  }
  if (args.classId === "canvas_wrap") {
    return pricedFromLab(blueWrenPrintLabAud(args.widthMm, args.heightMm, canvasWrapRate));
  }

  return null;
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

export const paperForClass = (classId: OfferClassId, catalogue: PosterFactoryCatalogue): string => {
  if (classId === "photographic" || classId === "photographic_mounted" || classId === "framed") {
    return catalogue.photographic.paper;
  }
  if (classId === "canvas") return OFFER_CANVAS_PAPER_LABEL;
  if (classId === "canvas_wrap") return OFFER_CANVAS_WRAP_PAPER_LABEL;
  return OFFER_FINE_ART_PAPER_LABEL;
};

export const printTypeForClass = (classId: OfferClassId): "fine_art" | "photo" | "canvas" => {
  if (classId === "canvas" || classId === "canvas_wrap") return "canvas";
  if (
    classId === "fine_art" ||
    classId === "fine_art_mounted" ||
    classId === "fine_art_framed"
  ) {
    return "fine_art";
  }
  return "photo";
};

export const supplierCodeForClass = (
  classId: OfferClassId,
  catalogue: PosterFactoryCatalogue,
): string | null => {
  if (classId === "photographic" || classId === "photographic_mounted") {
    return catalogue.photographic.productCode;
  }
  if (classId === "framed") return catalogue.framed.productCode;
  if (
    classId === "fine_art" ||
    classId === "fine_art_mounted" ||
    classId === "fine_art_framed"
  ) {
    return "canson-rag-photographique";
  }
  if (classId === "canvas_wrap") return "canson-photoart-pro-canvas-imagewrap";
  return "canson-photoart-pro-canvas";
};

const fulfilmentNotesForClass = (combo: OfferCombo, widthMm: number, heightMm: number, longEdgeMm: number): string => {
  const label = formatOfferVariantLabel(combo);
  const sizeNote = `Custom size ${widthMm}x${heightMm}mm (lock long_edge ${longEdgeMm}mm).`;
  switch (combo.classId) {
    case "photographic":
      return `${label}. ${sizeNote} Print on ${OFFER_PHOTOGRAPHIC_PAPER_LABEL} (Blue Wren).`;
    case "photographic_mounted":
      return `${label}. ${sizeNote} Print on ${OFFER_PHOTOGRAPHIC_PAPER_LABEL} with mountboard (Blue Wren).`;
    case "fine_art":
      return `${label}. ${sizeNote} Print on ${OFFER_FINE_ART_PAPER_LABEL} (Blue Wren).`;
    case "fine_art_mounted":
      return `${label}. ${sizeNote} Print on ${OFFER_FINE_ART_PAPER_LABEL} with mountboard (Blue Wren).`;
    case "framed":
      return `${label}. ${sizeNote} Print on ${OFFER_PHOTOGRAPHIC_PAPER_LABEL}, framed (Blue Wren).`;
    case "fine_art_framed":
      return `${label}. ${sizeNote} Print on ${OFFER_FINE_ART_PAPER_LABEL}, framed (Blue Wren).`;
    case "canvas":
      return `${label}. ${sizeNote} ${OFFER_CANVAS_PAPER_LABEL} sheet (no wrap).`;
    case "canvas_wrap":
      return `${label}. ${sizeNote} ${OFFER_CANVAS_WRAP_PAPER_LABEL}.`;
  }
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

    const isFramed = isFramedOfferClass(combo.classId);
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
  const combined = `${finishRaw} ${label}`;

  // Prefer exact finish labels from the current matrix.
  for (const classId of OFFER_CLASSES) {
    if (finishRaw === OFFER_CLASS_LABEL[classId].toLowerCase()) {
      return { sizeId, classId };
    }
  }

  if (combined.includes("image wrap") || combined.includes("canvas · image wrap")) {
    return { sizeId, classId: "canvas_wrap" };
  }
  if (combined.includes("mountboard") || combined.includes("mounted")) {
    if (combined.includes("tier 2") || combined.includes("fine art") || printType === "fine_art") {
      return { sizeId, classId: "fine_art_mounted" };
    }
    return { sizeId, classId: "photographic_mounted" };
  }
  if (
    finishRaw.includes("canvas") ||
    label.includes(" · canvas") ||
    label.endsWith("canvas") ||
    printType === "canvas"
  ) {
    return { sizeId, classId: "canvas" };
  }

  if (
    !unframedLabel &&
    (finishRaw.includes("framed") ||
      label.includes("framed") ||
      Boolean(variant.is_framed) ||
      /\bstandard frame\b/i.test(variant.variant_label ?? ""))
  ) {
    if (combined.includes("tier 2") || combined.includes("fine art") || printType === "fine_art") {
      return { sizeId, classId: "fine_art_framed" };
    }
    return { sizeId, classId: "framed" };
  }

  if (finishRaw.includes("tier 2") || label.includes("tier 2") || printType === "fine_art") {
    return { sizeId, classId: "fine_art" };
  }
  if (
    finishRaw.includes("tier 1") ||
    finishRaw.includes("photographic") ||
    label.includes("tier 1") ||
    label.includes("photographic print") ||
    printType === "photo"
  ) {
    return { sizeId, classId: "photographic" };
  }

  if (finishRaw.includes("archival matte") || label.includes("archival matte") || unframedLabel) {
    return { sizeId, classId: "fine_art" };
  }

  const fromClass = variant.fulfilment_class;
  if (fromClass === "standard") return { sizeId, classId: "photographic" };
  if (fromClass === "fine_art") return { sizeId, classId: "fine_art" };
  if (fromClass === "framed") {
    if (printType === "fine_art") return { sizeId, classId: "fine_art_framed" };
    return { sizeId, classId: "framed" };
  }
  if (fromClass === "canvas") return { sizeId, classId: "canvas" };

  return null;
};

export type BuyerFacingVariant = {
  tier_label?: string | null;
  variant_label?: string | null;
  finish?: string | null;
  is_framed?: boolean | null;
  print_type?: string | null;
  fulfilment_class?: string | null;
};

/**
 * Shopper-readable description of a stored variant. `variant_label` stays as the
 * internal fulfilment label ("A3 · Tier 1") because lab paperwork, admin and the
 * variant parser all key off it; use this anywhere a customer will read it.
 * Returns null for variants it cannot describe so callers can fall back to the
 * stored label.
 */
export const describeVariantForBuyer = (
  variant: BuyerFacingVariant,
  frameColour?: string | null,
): string | null => {
  const combo = parseOfferAxesFromVariant(variant);
  if (!combo) {
    // Custom-size labels are already written in buyer language, so only the
    // frame colour is missing.
    const label = variant.variant_label ?? "";
    if (frameColour && /^Custom .*· Framed$/.test(label)) {
      return `${label} · ${frameColour} frame`;
    }
    return null;
  }

  const { paper, presentation } = paperPresentationFromClassId(combo.classId);
  const parts = [
    OFFER_SIZE_LABEL[combo.sizeId],
    OFFER_PAPER_LABEL[paper],
    offerPresentationLabel(paper, presentation),
  ];
  if (isFramedOfferClass(combo.classId) && frameColour) {
    parts.push(`${frameColour} frame`);
  }
  return parts.join(" · ");
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
