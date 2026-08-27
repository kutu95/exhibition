import { describe, expect, it } from "vitest";

import {
  formatCustomSizeVariantLabel,
  formatVariantLabel,
  paperSelectValue,
  papersForPrintType,
  rateTierForPaper,
  suggestTierForLongEdge,
  tierGuidance,
} from "../lib/print-catalogue";
import {
  computeMarginGuidance,
  computeRetailFromLabCost,
  computeVariantPricing,
  deriveAspectPreservingSizeMm,
  estimatePixelPerfectLabCost,
  formatDualSize,
  formatLabDimensions,
  formatPhotoAspectSummary,
  inchesToMm,
  longEdgeFromDimensions,
  longEdgeInputToMm,
  matchLongEdgePreset,
  mmToInches,
  roundRetailPriceAud,
} from "../lib/print-size";

describe("print catalogue", () => {
  it("lists Blue Wren media by print type", () => {
    const fineArt = papersForPrintType("fine_art");
    expect(fineArt).toHaveLength(1);
    expect(fineArt[0]?.label).toBe("Canson Rag Photographique");
    expect(papersForPrintType("photo").some((p) => p.label.includes("Smooth Pearl"))).toBe(true);
    expect(papersForPrintType("canvas")).toHaveLength(2);
  });

  it("formats variant labels", () => {
    expect(formatVariantLabel(594, 445, "Hahnemühle Photo Rag 308gsm")).toBe(
      "594×445 mm / Hahnemühle Photo Rag 308gsm",
    );
  });

  it("formats custom-size shop labels with long-edge name and mm", () => {
    expect(
      formatCustomSizeVariantLabel({
        paperLabel: "Hahnemühle Photo Rag 308gsm",
        widthMm: 420,
        heightMm: 236,
        longEdgeMm: 420,
      }),
    ).toBe("Hahnemühle Photo Rag 308gsm · A3 long edge (420×236 mm)");
  });

  it("maps custom paper labels to other select value", () => {
    expect(paperSelectValue("My bespoke stock")).toBe("__other__");
  });

  it("assigns rate tiers for Blue Wren media", () => {
    expect(rateTierForPaper("Canson Rag Photographique")).toBe("standard_inkjet");
    expect(rateTierForPaper("Ilford Galerie Smooth Pearl")).toBe("standard_inkjet");
    expect(rateTierForPaper("Unknown stock")).toBe("standard_inkjet");
  });

  it("suggests a size-based tier from long edge", () => {
    expect(suggestTierForLongEdge(297, "fine_art")).toBe("Tier 1 - Entry / Gift");
    expect(suggestTierForLongEdge(594, "fine_art")).toBe("Tier 3 - Medium");
    expect(suggestTierForLongEdge(841, "fine_art")).toBe("Tier 5 - Large");
    expect(suggestTierForLongEdge(762, "canvas")).toBe("Canvas - Ready to Hang");
    expect(tierGuidance("Tier 5 - Large")).toContain("A1");
  });
});

describe("print size helpers", () => {
  it("derives landscape size from long edge", () => {
    const size = deriveAspectPreservingSizeMm(594, 4000, 3000);
    expect(size.width_mm).toBe(594);
    expect(size.height_mm).toBe(446);
  });

  it("derives portrait size from long edge", () => {
    const size = deriveAspectPreservingSizeMm(841, 3000, 4000);
    expect(size.height_mm).toBe(841);
    expect(size.width_mm).toBe(631);
  });

  it("summarises photo aspect", () => {
    expect(formatPhotoAspectSummary(4000, 3000)).toContain("4000 × 3000 px");
  });

  it("matches known long-edge presets", () => {
    expect(matchLongEdgePreset(420, 297)).toBe(420);
    expect(matchLongEdgePreset(500, 333)).toBe("custom");
    expect(longEdgeFromDimensions(420, 297)).toBe(420);
  });

  it("converts between mm and inches", () => {
    expect(mmToInches(254)).toBeCloseTo(10);
    expect(inchesToMm(10)).toBeCloseTo(254);
    expect(longEdgeInputToMm(24, "in")).toBe(610);
    expect(formatDualSize(594, 445)).toContain("Width 594 mm");
    expect(formatDualSize(594, 445)).toContain("Height 445 mm");
    expect(formatDualSize(594, 445)).toContain("Width");
    expect(formatDualSize(594, 445)).toContain("in");
  });

  it("formats lab dimensions in mm, cm, and inches for Pixel Perfect", () => {
    expect(formatLabDimensions(420, 594)).toBe("420 × 594 mm · 42.0 × 59.4 cm · 16.54 × 23.39 in");
  });

  it("estimates lab cost from size and Blue Wren paper rate", () => {
    // 14×11" on Smooth Pearl at ~8.26¢/in²
    const estimate = estimatePixelPerfectLabCost(
      inchesToMm(14),
      inchesToMm(11),
      "Ilford Galerie Smooth Pearl",
    );
    expect(estimate).not.toBeNull();
    expect(estimate!.ratePerSqInAud).toBeCloseTo(0.0826, 3);
    expect(estimate!.labCostAud).toBeCloseTo(14 * 11 * estimate!.ratePerSqInAud, 1);
  });

  it("computes margin against retail price", () => {
    const margin = computeMarginGuidance(120, 27.87);
    expect(margin).not.toBeNull();
    expect(margin!.marginAud).toBeCloseTo(92.13, 1);
    expect(margin!.marginPercent).toBeGreaterThan(70);
  });

  it("applies base price plus markup and rounds retail up", () => {
    // 27.87 * 3 = 83.61 → round up to nearest $5 = 85
    expect(computeRetailFromLabCost(27.87, 3)).toBe(85);
    // 25 + 83.61 = 108.61 → 110
    expect(computeRetailFromLabCost(27.87, 3, 25)).toBe(110);
    // >= 120 uses $10 steps: 40 + 27.87*3 = 123.61 → 130
    expect(computeRetailFromLabCost(27.87, 3, 40)).toBe(130);
    expect(roundRetailPriceAud(0)).toBe(0);
    expect(roundRetailPriceAud(100)).toBe(100);
    expect(roundRetailPriceAud(101)).toBe(105);
    expect(roundRetailPriceAud(120)).toBe(120);
    expect(roundRetailPriceAud(121)).toBe(130);

    const pricing = computeVariantPricing({
      widthMm: inchesToMm(14),
      heightMm: inchesToMm(11),
      paperLabel: "Hahnemühle Photo Rag 308gsm",
      markupFactor: 3,
      basePriceAud: 10,
    });
    expect(pricing).not.toBeNull();
    expect(pricing!.retailAud).toBe(roundRetailPriceAud(10 + pricing!.labCostAud * 3));
    expect(pricing!.basePriceAud).toBe(10);
  });
});
