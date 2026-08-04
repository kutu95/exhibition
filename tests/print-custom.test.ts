import { describe, expect, it } from "vitest";

import {
  computeCustomPrintPricing,
  CUSTOM_RTH_CANVAS_ID,
  deriveCustomSizeFromLongEdge,
  listCustomMediaOptions,
} from "../lib/print-custom";
import { SEED_FRAME_RATES, SEED_RTH_CANVAS_RATES } from "../lib/print-frame-pricing";

const baseArgs = {
  mediaMarkupFactor: 3,
  mediaBasePriceAud: 0,
  frameMarkupFactor: 3,
  frameBasePriceAud: 0,
  frameRates: SEED_FRAME_RATES,
  rthCanvasRates: SEED_RTH_CANVAS_RATES,
};

describe("custom print pricing", () => {
  it("lists papers plus ready-to-hang canvas", () => {
    const media = listCustomMediaOptions();
    expect(media.some((item) => item.id === "hm-photo-rag")).toBe(true);
    expect(media.some((item) => item.id === CUSTOM_RTH_CANVAS_ID)).toBe(true);
  });

  it("prices unframed paper and adds deluxe frame", () => {
    const size = deriveCustomSizeFromLongEdge(594, 4000, 3000);
    const unframed = computeCustomPrintPricing({
      ...baseArgs,
      widthMm: size.width_mm,
      heightMm: size.height_mm,
      mediaId: "hm-photo-rag",
      frameStyle: "none",
    })!;
    const deluxe = computeCustomPrintPricing({
      ...baseArgs,
      widthMm: size.width_mm,
      heightMm: size.height_mm,
      mediaId: "hm-photo-rag",
      frameStyle: "deluxe_perspex",
    })!;
    expect(unframed.frameLabAud).toBe(0);
    expect(deluxe.frameLabAud).toBeGreaterThan(0);
    expect(deluxe.retailAud).toBeGreaterThan(unframed.retailAud);
    expect(deluxe.variantLabel).toContain("Deluxe");
  });

  it("forces no frame for ready-to-hang canvas", () => {
    const size = deriveCustomSizeFromLongEdge(594, 4000, 3000);
    const priced = computeCustomPrintPricing({
      ...baseArgs,
      widthMm: size.width_mm,
      heightMm: size.height_mm,
      mediaId: CUSTOM_RTH_CANVAS_ID,
      frameStyle: "standard_perspex",
    })!;
    expect(priced.frameStyle).toBe("none");
    expect(priced.frameLabAud).toBe(0);
    expect(priced.printType).toBe("canvas");
  });
});
