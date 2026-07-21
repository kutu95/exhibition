import { describe, expect, it } from "vitest";

import {
  formatVariantLabel,
  paperSelectValue,
  papersForPrintType,
  rateTierForPaper,
  suggestTierForLongEdge,
  tierGuidance,
} from "../lib/print-catalogue";
import {
  computeMarginGuidance,
  deriveAspectPreservingSizeMm,
  estimatePixelPerfectLabCost,
  formatDualSize,
  formatPhotoAspectSummary,
  inchesToMm,
  longEdgeFromDimensions,
  longEdgeInputToMm,
  matchLongEdgePreset,
  mmToInches,
} from "../lib/print-size";

describe("print catalogue", () => {
  it("lists fine art papers for fine_art print type", () => {
    const papers = papersForPrintType("fine_art");
    expect(papers.length).toBeGreaterThan(5);
    expect(papers.some((paper) => paper.label.includes("Photo Rag"))).toBe(true);
  });

  it("formats variant labels", () => {
    expect(formatVariantLabel(594, 445, "Hahnemühle Photo Rag 308gsm")).toBe(
      "594×445 mm / Hahnemühle Photo Rag 308gsm",
    );
  });

  it("maps custom paper labels to other select value", () => {
    expect(paperSelectValue("My bespoke stock")).toBe("__other__");
  });

  it("assigns Pixel Perfect rate tiers", () => {
    expect(rateTierForPaper("Hahnemühle Photo Rag 308gsm")).toBe("standard_inkjet");
    expect(rateTierForPaper("Hahnemühle Photo Rag Pearl")).toBe("premium_inkjet");
    expect(rateTierForPaper("ChromaLuxe Metal Panel")).toBeNull();
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

  it("estimates Pixel Perfect lab cost from size and paper", () => {
    // 14x11" example from their FAQ: 14 × 11 × 0.181 = 27.87
    const estimate = estimatePixelPerfectLabCost(inchesToMm(14), inchesToMm(11), "Hahnemühle Photo Rag 308gsm");
    expect(estimate).not.toBeNull();
    expect(estimate!.labCostAud).toBeCloseTo(27.87, 1);
    expect(estimate!.ratePerSqInAud).toBe(0.181);
  });

  it("computes margin against retail price", () => {
    const margin = computeMarginGuidance(120, 27.87);
    expect(margin).not.toBeNull();
    expect(margin!.marginAud).toBeCloseTo(92.13, 1);
    expect(margin!.marginPercent).toBeGreaterThan(70);
  });
});
