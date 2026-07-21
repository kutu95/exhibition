import { formatMmAspect } from "./print-framing";
import {
  findPaperByLabel,
  PIXEL_PERFECT_PRICELIST_NOTE,
  PIXEL_PERFECT_SQ_IN_RATES_AUD,
  type PixelPerfectRateTier,
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
  const presets = [297, 420, 594, 841, 1189];
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
  rateTier: Exclude<PixelPerfectRateTier, null>;
  areaSqIn: number;
  note: string;
};

export const estimatePixelPerfectLabCost = (
  widthMm: number,
  heightMm: number,
  paperLabel: string,
): LabCostEstimate | null => {
  if (widthMm <= 0 || heightMm <= 0) return null;

  const paper = findPaperByLabel(paperLabel);
  const rateTier = paper?.rateTier ?? "standard_inkjet";
  if (!rateTier) return null;

  const ratePerSqInAud = PIXEL_PERFECT_SQ_IN_RATES_AUD[rateTier];
  const areaSqIn = mmToInches(widthMm) * mmToInches(heightMm);
  const labCostAud = Math.round(areaSqIn * ratePerSqInAud * 100) / 100;

  return {
    labCostAud,
    ratePerSqInAud,
    rateTier,
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
