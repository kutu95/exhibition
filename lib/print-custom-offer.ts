/**
 * Custom-size prints priced on the same rate card as the fixed shop sizes.
 *
 * The storefront chooser sells three papers × their finishes at four ISO sizes.
 * A custom print is the same product with a free-form long edge, so it must use
 * {@link computeOfferVariantPricing} rather than a parallel rate card — otherwise
 * a 420mm custom print and an A3 print cost different amounts for the same thing.
 *
 * The legacy per-paper calculator in `print-custom.ts` is kept for historical
 * variants and admin quoting; nothing buyer-facing should use it.
 */

import type { FulfilmentClass, FulfilmentProvider } from "./fulfilment";
import type { PosterFactoryCatalogue } from "./posterfactory";
import { clampCustomLongEdgeMm } from "./print-custom";
import type { FrameRateBand, RthCanvasRateBand } from "./print-frame-pricing";
import {
  classIdFromPaperPresentation,
  computeOfferVariantPricing,
  isFramedOfferClass,
  offerPresentationLabel,
  OFFER_CLASS_FULFILMENT,
  OFFER_CLASS_LABEL,
  OFFER_FRAME_TYPE_PIXEL_PERFECT,
  OFFER_PAPER_LABEL,
  OFFER_PAPER_PRESENTATIONS,
  OFFER_PAPER_IDS,
  paperForClass,
  printTypeForClass,
  supplierCodeForClass,
  type OfferClassId,
  type OfferPaperId,
  type OfferPresentationId,
} from "./print-offer";
import { deriveAspectPreservingSizeMm } from "./print-size";

/**
 * Custom sizes are printed to order from the master file on a roll, which is a
 * Pixel Perfect job regardless of which lab supplies the equivalent fixed size.
 */
export const CUSTOM_OFFER_PROVIDER: FulfilmentProvider = "pixelperfect";

/** Rate settings shared by the server and the client-side price preview. */
export type CustomOfferRates = {
  mediaMarkupFactor: number;
  mediaBasePriceAud: number;
  frameMarkupFactor: number;
  frameBasePriceAud: number;
  frameRates: FrameRateBand[];
  rthCanvasRates: RthCanvasRateBand[];
};

export type CustomOfferSelection = {
  longEdgeMm: number;
  paper: OfferPaperId;
  presentation: OfferPresentationId;
};

export type CustomOfferQuote = {
  classId: OfferClassId;
  paper: OfferPaperId;
  presentation: OfferPresentationId;
  longEdgeMm: number;
  widthMm: number;
  heightMm: number;
  aspectRatio: string | null;
  retailCents: number;
  labCostCents: number;
  mediaRetailAud: number;
  frameRetailAud: number;
  isFramed: boolean;
  variantLabel: string;
};

/**
 * Buyer-readable label for a custom variant, e.g.
 * `Custom 59 × 40 cm · Fine art rag · Mounted`.
 *
 * Fixed sizes use an A-code plus the internal tier ("A3 · Tier 1") because the
 * chooser and lab paperwork parse it. Custom variants sit outside that matrix,
 * so the label is what shoppers read in the cart and on the receipt; supplier
 * paper and exact millimetres go in `paper_type` and `fulfilment_notes`.
 */
export const formatCustomOfferVariantLabel = (args: {
  widthMm: number;
  heightMm: number;
  paper: OfferPaperId;
  presentation: OfferPresentationId;
}): string =>
  [
    `Custom ${Math.round(args.widthMm / 10)} × ${Math.round(args.heightMm / 10)} cm`,
    OFFER_PAPER_LABEL[args.paper],
    offerPresentationLabel(args.paper, args.presentation),
  ].join(" · ");

export const customOfferFulfilmentNotes = (quote: CustomOfferQuote, paperLabel: string): string =>
  [
    `${quote.variantLabel}.`,
    `Custom size ${quote.widthMm}x${quote.heightMm}mm (lock long_edge ${quote.longEdgeMm}mm).`,
    `Print on ${paperLabel}`,
    quote.presentation === "mounted"
      ? "with mountboard."
      : quote.isFramed
        ? "framed."
        : quote.presentation === "wrap"
          ? "stretched with image wrap."
          : "unframed.",
    "Order as a custom size at Pixel Perfect.",
  ].join(" ");

/**
 * Price one custom paper/finish combination. Returns null when the combination
 * cannot be priced at that size — most often a frame larger than the widest
 * moulding band — so callers can show it as unavailable.
 */
export const priceCustomOffer = (
  args: CustomOfferSelection & {
    pixelWidth: number;
    pixelHeight: number;
    rates: CustomOfferRates;
  },
): CustomOfferQuote | null => {
  if (args.pixelWidth <= 0 || args.pixelHeight <= 0) return null;

  const classId = classIdFromPaperPresentation(args.paper, args.presentation);
  if (!classId) return null;

  const longEdgeMm = clampCustomLongEdgeMm(args.longEdgeMm, args.pixelWidth, args.pixelHeight);
  const size = deriveAspectPreservingSizeMm(longEdgeMm, args.pixelWidth, args.pixelHeight);

  const pricing = computeOfferVariantPricing({
    widthMm: size.width_mm,
    heightMm: size.height_mm,
    classId,
    mediaMarkupFactor: args.rates.mediaMarkupFactor,
    mediaBasePriceAud: args.rates.mediaBasePriceAud,
    frameMarkupFactor: args.rates.frameMarkupFactor,
    frameBasePriceAud: args.rates.frameBasePriceAud,
    frameRates: args.rates.frameRates,
    rthCanvasRates: args.rates.rthCanvasRates,
  });
  if (!pricing) return null;

  return {
    classId,
    paper: args.paper,
    presentation: args.presentation,
    longEdgeMm,
    widthMm: size.width_mm,
    heightMm: size.height_mm,
    aspectRatio: size.aspect_ratio,
    retailCents: pricing.retailCents,
    labCostCents: pricing.labCostCents,
    mediaRetailAud: pricing.mediaRetailAud,
    frameRetailAud: pricing.frameRetailAud,
    isFramed: isFramedOfferClass(classId),
    variantLabel: formatCustomOfferVariantLabel({
      widthMm: size.width_mm,
      heightMm: size.height_mm,
      paper: args.paper,
      presentation: args.presentation,
    }),
  };
};

/** Papers that can be priced at this long edge, in chooser order. */
export const availableCustomPapers = (args: {
  longEdgeMm: number;
  pixelWidth: number;
  pixelHeight: number;
  rates: CustomOfferRates;
}): OfferPaperId[] =>
  OFFER_PAPER_IDS.filter((paper) =>
    OFFER_PAPER_PRESENTATIONS[paper].some(
      (presentation) => priceCustomOffer({ ...args, paper, presentation }) !== null,
    ),
  );

/** Finishes that can be priced for this paper at this long edge. */
export const availableCustomPresentations = (args: {
  longEdgeMm: number;
  paper: OfferPaperId;
  pixelWidth: number;
  pixelHeight: number;
  rates: CustomOfferRates;
}): OfferPresentationId[] =>
  OFFER_PAPER_PRESENTATIONS[args.paper].filter(
    (presentation) => priceCustomOffer({ ...args, presentation }) !== null,
  );

/** Database column values for a custom variant row. */
export type CustomOfferVariantFields = {
  variant_label: string;
  width_mm: number;
  height_mm: number;
  paper_type: string;
  print_type: "fine_art" | "photo" | "canvas";
  price_aud: number;
  lab_cost_aud: number;
  tier_label: "Custom";
  finish: string;
  is_framed: boolean;
  frame_type: string | null;
  fulfilment_notes: string;
  fulfilment_provider: FulfilmentProvider;
  fulfilment_class: FulfilmentClass;
  supplier_product_code: string | null;
  aspect_ratio: string | null;
};

export const customOfferVariantFields = (
  quote: CustomOfferQuote,
  catalogue: PosterFactoryCatalogue,
): CustomOfferVariantFields => {
  const paperLabel = paperForClass(quote.classId, catalogue);
  return {
    variant_label: quote.variantLabel,
    width_mm: quote.widthMm,
    height_mm: quote.heightMm,
    paper_type: paperLabel,
    print_type: printTypeForClass(quote.classId),
    price_aud: quote.retailCents,
    lab_cost_aud: quote.labCostCents,
    tier_label: "Custom",
    finish: OFFER_CLASS_LABEL[quote.classId],
    is_framed: quote.isFramed,
    frame_type: quote.isFramed ? OFFER_FRAME_TYPE_PIXEL_PERFECT : null,
    fulfilment_notes: customOfferFulfilmentNotes(quote, paperLabel),
    fulfilment_provider: CUSTOM_OFFER_PROVIDER,
    fulfilment_class: OFFER_CLASS_FULFILMENT[quote.classId],
    supplier_product_code: supplierCodeForClass(quote.classId, catalogue),
    aspect_ratio: quote.aspectRatio,
  };
};
