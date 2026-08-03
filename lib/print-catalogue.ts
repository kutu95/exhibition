export type PrintTypeCode = "fine_art" | "photo" | "canvas" | "metal";

/** Pixel Perfect April 2025 square-inch rate tiers (AUD incl. GST). */
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
  /** Cost-per-sq-in tier from Pixel Perfect pricelist; null when fixed/quote pricing. */
  rateTier: PixelPerfectRateTier;
};

/**
 * Pixel Perfect print formula: inches × inches × rate.
 * Source: https://pixelperfect.com.au/files/Pixel_Perfect_Pricelist.pdf (April 2025)
 * - standard_inkjet ($0.181): Matte papers / Canvas / Kodak Gloss / Kodak Matt / Ilford Smooth
 * - premium_inkjet ($0.217): Photo Paper / Natural Line / Pearl Metallic / Hahn Rag Pearl / Hahn Rag Metallic
 */
export const PIXEL_PERFECT_SQ_IN_RATES_AUD: Record<Exclude<PixelPerfectRateTier, null>, number> = {
  standard_inkjet: 0.181,
  premium_inkjet: 0.217,
};

export const PIXEL_PERFECT_PRICELIST_NOTE = "Pixel Perfect pricelist April 2025 (per sq in, GST incl.)";

/** Curated from Pixel Perfect's published fine art and C-type paper lists. */
export const PRINT_TYPES: PrintTypeOption[] = [
  {
    code: "fine_art",
    label: "Fine Art Giclée",
    description: "Pigment inkjet on archival cotton / art papers",
  },
  {
    code: "photo",
    label: "C-type Photo",
    description: "Silver-halide photographic papers (Kodak / Fuji)",
  },
  {
    code: "canvas",
    label: "Canvas",
    description: "Gallery canvas and ready-to-hang substrates",
  },
  {
    code: "metal",
    label: "Metal",
    description: "ChromaLuxe and metal print panels",
  },
];

export const PAPER_OPTIONS: PaperOption[] = [
  // Fine art — Hahnemühle & Canson (pixelperfect.com.au)
  { id: "hm-photo-rag", label: "Hahnemühle Photo Rag 308gsm", printType: "fine_art", rateTier: "standard_inkjet" },
  {
    id: "hm-photo-rag-bright-white",
    label: "Hahnemühle Photo Rag Bright White",
    printType: "fine_art",
    rateTier: "standard_inkjet",
  },
  { id: "hm-photo-rag-pearl", label: "Hahnemühle Photo Rag Pearl", printType: "fine_art", rateTier: "premium_inkjet" },
  {
    id: "hm-photo-rag-metallic",
    label: "Hahnemühle Photo Rag Metallic",
    printType: "fine_art",
    rateTier: "premium_inkjet",
  },
  { id: "hm-museum-etching", label: "Hahnemühle Museum Etching", printType: "fine_art", rateTier: "standard_inkjet" },
  {
    id: "canson-rag-photographique",
    label: "Canson Rag Photographique",
    printType: "fine_art",
    rateTier: "standard_inkjet",
  },
  { id: "hm-bamboo", label: "Hahnemühle Bamboo 290gsm", printType: "fine_art", rateTier: "premium_inkjet" },
  { id: "hm-hemp", label: "Hahnemühle Hemp 290gsm", printType: "fine_art", rateTier: "premium_inkjet" },
  { id: "hm-agave", label: "Hahnemühle Agave 290gsm", printType: "fine_art", rateTier: "premium_inkjet" },
  {
    id: "inkjetpro-textured",
    label: "INKJETpro Highly Textured Fine Art",
    printType: "fine_art",
    rateTier: "standard_inkjet",
  },
  {
    id: "kodak-inkjet-lustre",
    label: "Kodak Professional Inkjet Lustre",
    printType: "fine_art",
    rateTier: "standard_inkjet",
  },
  // C-type
  { id: "kodak-lustre", label: "Kodak Lustre", printType: "photo", rateTier: "premium_inkjet" },
  { id: "kodak-matt", label: "Kodak Matt", printType: "photo", rateTier: "standard_inkjet" },
  { id: "kodak-gloss", label: "Kodak Gloss", printType: "photo", rateTier: "standard_inkjet" },
  { id: "fuji-flex", label: "Fuji Flex", printType: "photo", rateTier: "premium_inkjet" },
  { id: "fuji-pearl-metallic", label: "Fuji Pearl Metallic", printType: "photo", rateTier: "premium_inkjet" },
  // Canvas / metal
  { id: "canson-photoart-canvas", label: "Canson PhotoArt Canvas", printType: "canvas", rateTier: "standard_inkjet" },
  { id: "chromaluxe-metal", label: "ChromaLuxe Metal Panel", printType: "metal", rateTier: null },
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
    summary: "Hero / gallery scale. Around A0 long edge (~1189 mm / 46.8 in).",
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

export const papersForPrintType = (printType: PrintTypeCode): PaperOption[] =>
  PAPER_OPTIONS.filter((paper) => paper.printType === printType);

export const findPaperByLabel = (label: string): PaperOption | undefined =>
  PAPER_OPTIONS.find((paper) => paper.label === label);

export const paperSelectValue = (paperLabel: string): string => {
  const match = findPaperByLabel(paperLabel);
  return match?.id ?? (paperLabel.trim() ? OTHER_PAPER_ID : "");
};

export const paperLabelFromSelect = (selectValue: string, customPaper: string): string => {
  if (selectValue === OTHER_PAPER_ID) return customPaper.trim();
  const match = PAPER_OPTIONS.find((paper) => paper.id === selectValue);
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

export const defaultPrintTypeForPaper = (paperLabel: string): PrintTypeCode => {
  const match = findPaperByLabel(paperLabel);
  return match?.printType ?? "fine_art";
};

export const rateTierForPaper = (paperLabel: string): PixelPerfectRateTier => {
  const match = findPaperByLabel(paperLabel);
  if (!match) return "standard_inkjet";
  return match.rateTier;
};
