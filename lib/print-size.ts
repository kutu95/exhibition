import { formatMmAspect } from "./print-framing";
import {
  PIXEL_PERFECT_PRICELIST_NOTE,
  ratePerSqInForPaper,
  seedManagedPapers,
  type ManagedPaper,
} from "./print-catalogue";

export const MM_PER_INCH = 25.4;

export type SizeUnit = "mm" | "in";

/** Derive width and height (mm) from a long-edge length while preserving photo aspect ratio. */
export const deriveAspectPreservingSizeMm = (
  longEdgeMm: number,
  pixelWidth: number,
  pixelHeight: number,
): { width_mm: number; height_mm: number; aspect_ratio: string | null } => {
  if (longEdgeMm <= 0 || pixelWidth <= 0 || pixelHeight <= 0) {
    throw new Error("Long edge and pixel dimensions must be positive.");
  }

  const aspect = pixelWidth / pixelHeight;

  if (aspect >= 1) {
    const width_mm = Math.round(longEdgeMm);
    const height_mm = Math.max(1, Math.round(longEdgeMm / aspect));
    return { width_mm, height_mm, aspect_ratio: formatMmAspect(width_mm, height_mm) };
  }

  const height_mm = Math.round(longEdgeMm);
  const width_mm = Math.max(1, Math.round(longEdgeMm * aspect));
  return { width_mm, height_mm, aspect_ratio: formatMmAspect(width_mm, height_mm) };
};

export const formatPhotoAspectSummary = (
  pixelWidth: number | null,
  pixelHeight: number | null,
): string | null => {
  if (!pixelWidth || !pixelHeight || pixelWidth <= 0 || pixelHeight <= 0) return null;
  const aspect = pixelWidth / pixelHeight;
  return `${pixelWidth} × ${pixelHeight} px (${aspect.toFixed(3)}:1)`;
};

export const longEdgeFromDimensions = (widthMm: number, heightMm: number): number =>
  Math.max(widthMm, heightMm);

export const matchLongEdgePreset = (widthMm: number, heightMm: number): number | "custom" => {
  const longEdge = longEdgeFromDimensions(widthMm, heightMm);
  const presets = [297, 420, 594, 841, 1189, 1524, 1626];
  return presets.includes(longEdge) ? longEdge : "custom";
};

export const mmToInches = (mm: number): number => mm / MM_PER_INCH;

export const inchesToMm = (inches: number): number => inches * MM_PER_INCH;

export const roundDisplayValue = (value: number, unit: SizeUnit): number => {
  if (unit === "mm") return Math.round(value);
  return Math.round(value * 100) / 100;
};

export const formatSizePair = (widthMm: number, heightMm: number, unit: SizeUnit): string => {
  if (unit === "mm") {
    return `Width ${Math.round(widthMm)} mm × Height ${Math.round(heightMm)} mm`;
  }
  const widthIn = roundDisplayValue(mmToInches(widthMm), "in");
  const heightIn = roundDisplayValue(mmToInches(heightMm), "in");
  return `Width ${widthIn} in × Height ${heightIn} in`;
};

export const formatDualSize = (widthMm: number, heightMm: number): string =>
  `${formatSizePair(widthMm, heightMm, "mm")} · ${formatSizePair(widthMm, heightMm, "in")}`;

/** Compact mm / cm / in line for Pixel Perfect paste and the fulfilment dashboard. */
export const formatLabDimensions = (widthMm: number, heightMm: number): string => {
  const wMm = Math.round(widthMm);
  const hMm = Math.round(heightMm);
  const wCm = (Math.round(widthMm) / 10).toFixed(1);
  const hCm = (Math.round(heightMm) / 10).toFixed(1);
  const wIn = roundDisplayValue(mmToInches(widthMm), "in");
  const hIn = roundDisplayValue(mmToInches(heightMm), "in");
  return `${wMm} × ${hMm} mm · ${wCm} × ${hCm} cm · ${wIn} × ${hIn} in`;
};

export const longEdgeInputToMm = (value: number, unit: SizeUnit): number => {
  if (value <= 0) return 0;
  return unit === "mm" ? Math.round(value) : Math.round(inchesToMm(value));
};

export const longEdgeMmToInput = (longEdgeMm: number, unit: SizeUnit): number => {
  if (longEdgeMm <= 0) return 0;
  return unit === "mm" ? longEdgeMm : roundDisplayValue(mmToInches(longEdgeMm), "in");
};

export type LabCostEstimate = {
  labCostAud: number;
  ratePerSqInAud: number;
  areaSqIn: number;
  note: string;
};

export const estimatePixelPerfectLabCost = (
  widthMm: number,
  heightMm: number,
  paperLabel: string,
  papers: ManagedPaper[] = seedManagedPapers(),
): LabCostEstimate | null => {
  if (widthMm <= 0 || heightMm <= 0) return null;

  const ratePerSqInAud = ratePerSqInForPaper(paperLabel, papers);
  if (ratePerSqInAud === null) return null;

  const areaSqIn = mmToInches(widthMm) * mmToInches(heightMm);
  const labCostAud = Math.round(areaSqIn * ratePerSqInAud * 100) / 100;

  return {
    labCostAud,
    ratePerSqInAud,
    areaSqIn: Math.round(areaSqIn * 100) / 100,
    note: PIXEL_PERFECT_PRICELIST_NOTE,
  };
};

export type MarginGuidance = {
  retailAud: number;
  labCostAud: number;
  marginAud: number;
  marginPercent: number | null;
};

export const computeMarginGuidance = (retailAud: number, labCostAud: number): MarginGuidance | null => {
  if (!Number.isFinite(retailAud) || !Number.isFinite(labCostAud) || labCostAud < 0) return null;
  const marginAud = Math.round((retailAud - labCostAud) * 100) / 100;
  const marginPercent = retailAud > 0 ? Math.round(((retailAud - labCostAud) / retailAud) * 1000) / 10 : null;
  return { retailAud, labCostAud, marginAud, marginPercent };
};

/** Round retail up to nearest $5 if under $120, else nearest $10. $0 stays $0. */
export const roundRetailPriceAud = (priceAud: number): number => {
  if (!Number.isFinite(priceAud) || priceAud <= 0) return 0;
  const step = priceAud < 120 ? 5 : 10;
  return Math.ceil(priceAud / step) * step;
};

/** Retail = roundUp(basePrice + lab cost × markup). */
export const computeRetailFromLabCost = (
  labCostAud: number,
  markupFactor: number,
  basePriceAud = 0,
): number => {
  if (!Number.isFinite(labCostAud) || labCostAud < 0 || !Number.isFinite(markupFactor) || markupFactor < 1) {
    throw new Error("Lab cost and markup factor must be valid numbers (markup ≥ 1).");
  }
  if (!Number.isFinite(basePriceAud) || basePriceAud < 0) {
    throw new Error("Base price must be a number of 0 or more.");
  }
  const raw = Math.round((basePriceAud + labCostAud * markupFactor) * 100) / 100;
  return roundRetailPriceAud(raw);
};

export type VariantPricing = {
  widthMm: number;
  heightMm: number;
  labCostAud: number;
  labCostCents: number;
  retailAud: number;
  retailCents: number;
  markupFactor: number;
  basePriceAud: number;
  ratePerSqInAud: number;
  areaSqIn: number;
  note: string;
};

/**
 * Lab cost from paper sq-in rate, retail = roundUp(base + lab × markup).
 * Returns null when paper has no sq-in rate (quote-only substrates).
 */
export const computeVariantPricing = (args: {
  widthMm: number;
  heightMm: number;
  paperLabel: string;
  markupFactor: number;
  basePriceAud?: number;
  papers?: ManagedPaper[];
}): VariantPricing | null => {
  const estimate = estimatePixelPerfectLabCost(
    args.widthMm,
    args.heightMm,
    args.paperLabel,
    args.papers ?? seedManagedPapers(),
  );
  if (!estimate) return null;

  const basePriceAud = args.basePriceAud ?? 0;
  const retailAud = computeRetailFromLabCost(estimate.labCostAud, args.markupFactor, basePriceAud);
  return {
    widthMm: Math.round(args.widthMm),
    heightMm: Math.round(args.heightMm),
    labCostAud: estimate.labCostAud,
    labCostCents: Math.round(estimate.labCostAud * 100),
    retailAud,
    retailCents: Math.round(retailAud * 100),
    markupFactor: args.markupFactor,
    basePriceAud,
    ratePerSqInAud: estimate.ratePerSqInAud,
    areaSqIn: estimate.areaSqIn,
    note: estimate.note,
  };
};
