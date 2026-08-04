import {
  PAPER_OPTIONS,
  PIXEL_PERFECT_SQ_IN_RATES_AUD,
  ratePerSqInForPaper,
  seedManagedPapers,
  type ManagedPaper,
  type PrintTypeCode,
} from "./print-catalogue";
import {
  computeFrameRetailAud,
  computeRthCanvasRetailAud,
  lookupBandByUnitedInches,
  type FrameRateBand,
  type RthCanvasRateBand,
  unitedInchesFromMm,
} from "./print-frame-pricing";
import {
  computeRetailFromLabCost,
  deriveAspectPreservingSizeMm,
  mmToInches,
} from "./print-size";

/** Flip to false to hide the custom print link and 404 the custom page. */
export const SHOW_CUSTOM_PRINT_PAGE = true;

export const CUSTOM_LONG_EDGE_MIN_MM = 200;
export const CUSTOM_LONG_EDGE_MAX_MM = 1189;
export const CUSTOM_LONG_EDGE_DEFAULT_MM = 594;

export const CUSTOM_RTH_CANVAS_ID = "rth-canvas-package";

export type CustomFrameStyleId = "none" | "standard_perspex" | "deluxe_perspex";

export type CustomFrameOption = {
  id: CustomFrameStyleId;
  label: string;
  summary: string;
  /** Corner / moulding sample shown beside the option. */
  sampleImage?: string;
};

export const CUSTOM_FRAME_OPTIONS: CustomFrameOption[] = [
  {
    id: "none",
    label: "Unframed",
    summary: "Print only — shipped flat or in a tube",
  },
  {
    id: "standard_perspex",
    label: "Standard frame",
    summary: "20mm Standard moulding with Perspex (shippable)",
    sampleImage: "/frames/standard-sample.jpg",
  },
  {
    id: "deluxe_perspex",
    label: "Deluxe frame",
    summary: "Slim 10mm Deluxe moulding with Perspex (shippable)",
    sampleImage: "/frames/deluxe-sample.jpg",
  },
];

/** Sample used for the shop “Framed” presentation (Standard moulding). */
export const OFFER_FRAMED_SAMPLE_IMAGE = "/frames/standard-sample.jpg";
/** PDF framing-section moulding corners (Pixel Perfect pricelist). */
export const FRAME_MOULDING_CORNERS_IMAGE = "/frames/moulding-corners.jpg";

/** Deluxe moulding lab AUD by united inches (Pixel Perfect April 2025). */
export const SEED_DELUXE_FRAME_BY_UIN: Record<number, number> = {
  20: 102.73,
  24: 118.79,
  28: 134.84,
  31: 153.04,
  35: 172.29,
  39: 192.63,
  43: 214.03,
  47: 237.57,
  51: 261.11,
  55: 286.81,
  59: 312.49,
  63: 340.32,
  67: 370.27,
  71: 400.24,
  75: 431.28,
  79: 464.45,
  83: 498.7,
  87: 534.01,
};

export type CustomMediaOption = {
  id: string;
  label: string;
  printType: PrintTypeCode | "rth_canvas";
  /** Null for RTH package (priced separately). */
  ratePerSqInAud: number | null;
  kind: "paper" | "rth_canvas";
};

export const listCustomMediaOptions = (papers: ManagedPaper[] = seedManagedPapers()): CustomMediaOption[] => {
  const fromStore = papers
    .filter((paper) => paper.isActive && paper.ratePerSqInAud !== null)
    .map((paper) => ({
      id: paper.id,
      label: paper.label,
      printType: paper.printType,
      ratePerSqInAud: paper.ratePerSqInAud,
      kind: "paper" as const,
    }));

  const fallback = PAPER_OPTIONS.filter((paper) => paper.rateTier !== null).map((paper) => ({
    id: paper.id,
    label: paper.label,
    printType: paper.printType,
    ratePerSqInAud: PIXEL_PERFECT_SQ_IN_RATES_AUD[paper.rateTier!],
    kind: "paper" as const,
  }));

  const media = fromStore.length > 0 ? fromStore : fallback;

  return [
    ...media,
    {
      id: CUSTOM_RTH_CANVAS_ID,
      label: "Ready-to-hang canvas (stretched)",
      printType: "rth_canvas",
      ratePerSqInAud: null,
      kind: "rth_canvas",
    },
  ];
};

export type CustomPrintPricingInput = {
  widthMm: number;
  heightMm: number;
  mediaId: string;
  frameStyle: CustomFrameStyleId;
  mediaMarkupFactor: number;
  mediaBasePriceAud: number;
  frameMarkupFactor: number;
  frameBasePriceAud: number;
  frameRates: FrameRateBand[];
  rthCanvasRates: RthCanvasRateBand[];
  papers?: ManagedPaper[];
};

export type CustomPrintPricingResult = {
  widthMm: number;
  heightMm: number;
  mediaLabel: string;
  printType: string;
  frameStyle: CustomFrameStyleId;
  frameLabel: string;
  mediaLabAud: number;
  frameLabAud: number;
  mediaRetailAud: number;
  frameRetailAud: number;
  labCostAud: number;
  labCostCents: number;
  retailAud: number;
  retailCents: number;
  variantLabel: string;
  isFramed: boolean;
  frameType: string | null;
  paperType: string;
  fulfilmentNotes: string;
};

const resolveMedia = (
  mediaId: string,
  papers: ManagedPaper[],
): CustomMediaOption | null =>
  listCustomMediaOptions(papers).find((item) => item.id === mediaId) ?? null;

const deluxeLabCostAud = (band: FrameRateBand): number | null => {
  const deluxeAud = SEED_DELUXE_FRAME_BY_UIN[band.uin];
  if (deluxeAud === undefined) return null;
  return Math.round((deluxeAud + band.perspexAud) * 100) / 100;
};

export const computeCustomPrintPricing = (
  input: CustomPrintPricingInput,
): CustomPrintPricingResult | null => {
  if (input.widthMm <= 0 || input.heightMm <= 0) return null;

  const papers = input.papers ?? seedManagedPapers();
  const media = resolveMedia(input.mediaId, papers);
  if (!media) return null;

  const isRth = media.kind === "rth_canvas";
  const frameStyle: CustomFrameStyleId = isRth ? "none" : input.frameStyle;
  const frameOption = CUSTOM_FRAME_OPTIONS.find((item) => item.id === frameStyle)!;

  let mediaLabAud = 0;
  let mediaRetailAud = 0;

  if (isRth) {
    const rth = computeRthCanvasRetailAud({
      widthMm: input.widthMm,
      heightMm: input.heightMm,
      rthRates: input.rthCanvasRates,
      markupFactor: input.mediaMarkupFactor,
      basePriceAud: input.mediaBasePriceAud,
    });
    if (!rth) return null;
    mediaLabAud = rth.labCostAud;
    mediaRetailAud = rth.retailAud;
  } else {
    const rate =
      media.ratePerSqInAud ??
      ratePerSqInForPaper(media.label, papers) ??
      null;
    if (rate === null) return null;
    const areaSqIn = mmToInches(input.widthMm) * mmToInches(input.heightMm);
    mediaLabAud = Math.round(areaSqIn * rate * 100) / 100;
    mediaRetailAud = computeRetailFromLabCost(
      mediaLabAud,
      input.mediaMarkupFactor,
      input.mediaBasePriceAud,
    );
  }

  let frameLabAud = 0;
  let frameRetailAud = 0;
  if (frameStyle !== "none") {
    const uin = unitedInchesFromMm(input.widthMm, input.heightMm);
    const band = lookupBandByUnitedInches(uin, input.frameRates);
    if (!band) return null;

    if (frameStyle === "standard_perspex") {
      const frame = computeFrameRetailAud({
        widthMm: input.widthMm,
        heightMm: input.heightMm,
        frameRates: input.frameRates,
        markupFactor: input.frameMarkupFactor,
        basePriceAud: input.frameBasePriceAud,
      });
      if (!frame) return null;
      frameLabAud = frame.labCostAud;
      frameRetailAud = frame.retailAud;
    } else {
      const lab = deluxeLabCostAud(band);
      if (lab === null) return null;
      frameLabAud = lab;
      frameRetailAud = computeRetailFromLabCost(
        lab,
        input.frameMarkupFactor,
        input.frameBasePriceAud,
      );
    }
  }

  const labCostAud = Math.round((mediaLabAud + frameLabAud) * 100) / 100;
  const retailAud = Math.round((mediaRetailAud + frameRetailAud) * 100) / 100;
  const paperType = isRth ? "Canson PhotoArt Canvas" : media.label;
  const printType = isRth ? "canvas" : media.printType;
  const isFramed = frameStyle !== "none";
  const frameType = isFramed ? frameStyle : null;
  const variantLabel = isRth
    ? `Custom · Ready-to-hang canvas · ${Math.round(input.widthMm)}×${Math.round(input.heightMm)} mm`
    : `Custom · ${media.label} · ${Math.round(input.widthMm)}×${Math.round(input.heightMm)} mm${
        isFramed ? ` · ${frameOption.label}` : " · Unframed"
      }`;

  const fulfilmentNotes = [
    variantLabel + ".",
    `Custom size ${Math.round(input.widthMm)}x${Math.round(input.heightMm)}mm (lock long_edge).`,
    isRth
      ? "Order as ready-to-hang canvas package at Pixel Perfect."
      : isFramed
        ? `Order print + ${frameStyle === "deluxe_perspex" ? "Deluxe" : "Standard"} frame with Perspex (do not use glass for shipping).`
        : "Order as custom paper at Pixel Perfect.",
  ].join(" ");

  return {
    widthMm: Math.round(input.widthMm),
    heightMm: Math.round(input.heightMm),
    mediaLabel: media.label,
    printType,
    frameStyle,
    frameLabel: frameOption.label,
    mediaLabAud,
    frameLabAud,
    mediaRetailAud,
    frameRetailAud,
    labCostAud,
    labCostCents: Math.round(labCostAud * 100),
    retailAud,
    retailCents: Math.round(retailAud * 100),
    variantLabel,
    isFramed,
    frameType,
    paperType,
    fulfilmentNotes,
  };
};

export const deriveCustomSizeFromLongEdge = (
  longEdgeMm: number,
  pixelWidth: number,
  pixelHeight: number,
): { width_mm: number; height_mm: number; aspect_ratio: string | null } => {
  const clamped = Math.min(
    CUSTOM_LONG_EDGE_MAX_MM,
    Math.max(CUSTOM_LONG_EDGE_MIN_MM, Math.round(longEdgeMm)),
  );
  return deriveAspectPreservingSizeMm(clamped, pixelWidth, pixelHeight);
};
