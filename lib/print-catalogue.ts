import {
  BLUE_WREN_CANVAS_IMAGEWRAP_LABEL,
  BLUE_WREN_CANVAS_IMAGEWRAP_RATE_PER_SQ_IN,
  BLUE_WREN_CANVAS_LABEL,
  BLUE_WREN_RAG_CANVAS_RATE_PER_SQ_IN,
  BLUE_WREN_RAG_PHOTOGRAPHIQUE_LABEL,
  BLUE_WREN_SMOOTH_PEARL_LABEL,
  BLUE_WREN_SMOOTH_PEARL_RATE_PER_SQ_IN,
} from "./bluewren";

export type PrintTypeCode = "fine_art" | "photo" | "canvas" | "metal";

/** @deprecated Pixel Perfect April 2025 tiers — kept for legacy quote fallbacks. */
export type PixelPerfectRateTier = "standard_inkjet" | "premium_inkjet" | null;

export type PrintTypeOption = {
  code: PrintTypeCode;
  label: string;
  description: string;
};

export type PaperOption = {
  id: string;
  label: string;
  printType: PrintTypeCode;
  /** Explicit Blue Wren (or other) sq-in rate; null = quote-only. */
  ratePerSqInAud: number | null;
  /** @deprecated Prefer ratePerSqInAud. */
  rateTier: PixelPerfectRateTier;
};

/** Admin-managed paper / medium with an explicit sq-in rate (null = quote-only). */
export type ManagedPaper = {
  id: string;
  label: string;
  printType: PrintTypeCode;
  ratePerSqInAud: number | null;
  isActive: boolean;
  sortOrder: number;
};

/**
 * @deprecated Prefer Blue Wren rates on PAPER_OPTIONS / seedManagedPapers.
 * Pixel Perfect print formula: inches × inches × rate.
 */
export const PIXEL_PERFECT_SQ_IN_RATES_AUD: Record<Exclude<PixelPerfectRateTier, null>, number> = {
  standard_inkjet: 0.181,
  premium_inkjet: 0.217,
};

export const PIXEL_PERFECT_PRICELIST_NOTE = "Pixel Perfect pricelist April 2025 (per sq in, GST incl.)";

/** Shop + custom print media — Blue Wren artist sheet only. */
export const PRINT_TYPES: PrintTypeOption[] = [
  {
    code: "photo",
    label: "Tier 1",
    description: "Ilford Galerie Smooth Pearl",
  },
  {
    code: "fine_art",
    label: "Tier 2",
    description: "Canson Rag Photographique",
  },
  {
    code: "canvas",
    label: "Canvas",
    description: "Canson Photoart Pro Canvas (not Tier 1 or Tier 2)",
  },
];

export const PAPER_OPTIONS: PaperOption[] = [
  {
    id: "ilford-galerie-smooth-pearl",
    label: BLUE_WREN_SMOOTH_PEARL_LABEL,
    printType: "photo",
    ratePerSqInAud: BLUE_WREN_SMOOTH_PEARL_RATE_PER_SQ_IN,
    rateTier: "standard_inkjet",
  },
  {
    id: "canson-rag-photographique",
    label: BLUE_WREN_RAG_PHOTOGRAPHIQUE_LABEL,
    printType: "fine_art",
    ratePerSqInAud: BLUE_WREN_RAG_CANVAS_RATE_PER_SQ_IN,
    rateTier: "standard_inkjet",
  },
  {
    id: "canson-photoart-pro-canvas",
    label: BLUE_WREN_CANVAS_LABEL,
    printType: "canvas",
    ratePerSqInAud: BLUE_WREN_RAG_CANVAS_RATE_PER_SQ_IN,
    rateTier: "standard_inkjet",
  },
  {
    id: "canson-photoart-pro-canvas-imagewrap",
    label: BLUE_WREN_CANVAS_IMAGEWRAP_LABEL,
    printType: "canvas",
    ratePerSqInAud: BLUE_WREN_CANVAS_IMAGEWRAP_RATE_PER_SQ_IN,
    rateTier: "standard_inkjet",
  },
];

export type LongEdgePreset = {
  mm: number;
  labelMm: string;
  labelIn: string;
};

/** Common long-edge sizes derived from ISO paper dimensions and Pixel Perfect large-format options. */
export const LONG_EDGE_PRESETS: LongEdgePreset[] = [
  { mm: 297, labelMm: "A4 long edge (297 mm)", labelIn: "A4 long edge (11.7 in)" },
  { mm: 420, labelMm: "A3 long edge (420 mm)", labelIn: "A3 long edge (16.5 in)" },
  { mm: 594, labelMm: "A2 long edge (594 mm)", labelIn: "A2 long edge (23.4 in)" },
  { mm: 841, labelMm: "A1 long edge (841 mm)", labelIn: "A1 long edge (33.1 in)" },
  { mm: 1189, labelMm: "A0 long edge (1189 mm)", labelIn: "A0 long edge (46.8 in)" },
  { mm: 1524, labelMm: "60 in long edge (1524 mm)", labelIn: "60 in long edge (60 in)" },
  { mm: 1626, labelMm: "64 in / printer width (1626 mm)", labelIn: "64 in / printer width (64 in)" },
];

export const OTHER_PAPER_ID = "__other__";

/**
 * Product range tiers used on the fulfilment dashboard ("Range").
 * Mapped from the exhibition print catalogue (size / positioning, not paper).
 */
export type TierOption = {
  id: string;
  label: string;
  summary: string;
  /** Typical long-edge band in mm (inclusive); used to suggest a tier from size. */
  longEdgeMinMm: number;
  longEdgeMaxMm: number;
};

export const TIER_OPTIONS: TierOption[] = [
  {
    id: "tier-1",
    label: "Tier 1 - Entry / Gift",
    summary: "Small gift / desk size. Around A4 long edge (~297 mm / 11.7 in).",
    longEdgeMinMm: 0,
    longEdgeMaxMm: 350,
  },
  {
    id: "tier-2",
    label: "Tier 2 - Small",
    summary: "Small wall print. Around A3 long edge (~420 mm / 16.5 in).",
    longEdgeMinMm: 351,
    longEdgeMaxMm: 500,
  },
  {
    id: "tier-3",
    label: "Tier 3 - Medium",
    summary: "Core medium wall size. Around A2 long edge (~594 mm / 23.4 in).",
    longEdgeMinMm: 501,
    longEdgeMaxMm: 650,
  },
  {
    id: "tier-4",
    label: "Tier 4 - Medium Large",
    summary: "Premium A2-class option (e.g. Pearl paper) — same size band as Medium, higher finish.",
    longEdgeMinMm: 501,
    longEdgeMaxMm: 650,
  },
  {
    id: "tier-5",
    label: "Tier 5 - Large",
    summary: "Large statement piece. Around A1 long edge (~841 mm / 33.1 in).",
    longEdgeMinMm: 651,
    longEdgeMaxMm: 1000,
  },
  {
    id: "tier-6",
    label: "Tier 6 - Statement",
    summary: "Hero / gallery scale. A0 and beyond, up to Pixel Perfect’s ~1.5 m roll width.",
    longEdgeMinMm: 1001,
    longEdgeMaxMm: 10000,
  },
  {
    id: "canvas-rth",
    label: "Canvas - Ready to Hang",
    summary: "Gallery-wrapped canvas with hanging hardware — not a paper print.",
    longEdgeMinMm: 0,
    longEdgeMaxMm: 10000,
  },
];

export const suggestTierForLongEdge = (longEdgeMm: number, printType: PrintTypeCode): string => {
  if (printType === "canvas") return "Canvas - Ready to Hang";
  if (longEdgeMm <= 0) return "";
  const match = TIER_OPTIONS.find(
    (tier) =>
      tier.id !== "canvas-rth" &&
      tier.id !== "tier-4" &&
      longEdgeMm >= tier.longEdgeMinMm &&
      longEdgeMm <= tier.longEdgeMaxMm,
  );
  return match?.label ?? "";
};

export const tierGuidance = (tierLabel: string): string | null =>
  TIER_OPTIONS.find((tier) => tier.label === tierLabel)?.summary ?? null;

/** Seed managed papers from the Blue Wren media list. */
export const seedManagedPapers = (): ManagedPaper[] =>
  PAPER_OPTIONS.map((paper, index) => ({
    id: paper.id,
    label: paper.label,
    printType: paper.printType,
    ratePerSqInAud: paper.ratePerSqInAud,
    isActive: true,
    sortOrder: index,
  }));

export const sortManagedPapers = (papers: ManagedPaper[]): ManagedPaper[] =>
  [...papers].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

export const papersForPrintType = (printType: PrintTypeCode, papers: ManagedPaper[] = seedManagedPapers()): ManagedPaper[] =>
  sortManagedPapers(papers).filter((paper) => paper.printType === printType && paper.isActive);

export const findPaperByLabel = (
  label: string,
  papers: ManagedPaper[] = seedManagedPapers(),
): ManagedPaper | undefined => papers.find((paper) => paper.label === label);

export const findPaperById = (id: string, papers: ManagedPaper[] = seedManagedPapers()): ManagedPaper | undefined =>
  papers.find((paper) => paper.id === id);

export const paperSelectValue = (paperLabel: string, papers: ManagedPaper[] = seedManagedPapers()): string => {
  const match = findPaperByLabel(paperLabel, papers);
  return match?.id ?? (paperLabel.trim() ? OTHER_PAPER_ID : "");
};

export const paperLabelFromSelect = (
  selectValue: string,
  customPaper: string,
  papers: ManagedPaper[] = seedManagedPapers(),
): string => {
  if (selectValue === OTHER_PAPER_ID) return customPaper.trim();
  const match = findPaperById(selectValue, papers);
  return match?.label ?? customPaper.trim();
};

export const formatVariantLabel = (widthMm: number, heightMm: number, paper: string): string => {
  const paperPart = paper.trim() || "Print";
  return `${widthMm}×${heightMm} mm / ${paperPart}`;
};

/** Shop-facing label for aspect-true custom sizes: paper · preset (W×H mm). */
export const formatCustomSizeVariantLabel = (args: {
  paperLabel: string;
  widthMm: number;
  heightMm: number;
  longEdgeMm: number;
}): string => {
  const paper = args.paperLabel.trim() || "Print";
  const preset = LONG_EDGE_PRESETS.find((item) => item.mm === args.longEdgeMm);
  const sizeName = preset ? preset.labelMm.replace(/\s*\(\d+\s*mm\)\s*$/i, "").trim() : `${args.longEdgeMm} mm long edge`;
  return `${paper} · ${sizeName} (${args.widthMm}×${args.heightMm} mm)`;
};

export const defaultPrintTypeForPaper = (
  paperLabel: string,
  papers: ManagedPaper[] = seedManagedPapers(),
): PrintTypeCode => {
  const match = findPaperByLabel(paperLabel, papers);
  return match?.printType ?? "fine_art";
};

export const ratePerSqInForPaper = (
  paperLabel: string,
  papers: ManagedPaper[] = seedManagedPapers(),
): number | null => {
  const match = findPaperByLabel(paperLabel, papers);
  if (!match) {
    return BLUE_WREN_SMOOTH_PEARL_RATE_PER_SQ_IN;
  }
  return match.ratePerSqInAud;
};

/** @deprecated Prefer ratePerSqInForPaper. */
export const rateTierForPaper = (paperLabel: string): PixelPerfectRateTier => {
  const match = PAPER_OPTIONS.find((paper) => paper.label === paperLabel);
  if (!match) return "standard_inkjet";
  return match.rateTier;
};
