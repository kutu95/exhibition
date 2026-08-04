import { describe, expect, it } from "vitest";

import {
  lookupBandByUnitedInches,
  SEED_FRAME_RATES,
  SEED_RTH_CANVAS_RATES,
  unitedInchesFromMm,
  frameLabCostAud,
} from "../lib/print-frame-pricing";
import {
  buildOfferVariantsForProduct,
  computeOfferVariantPricing,
  findVariantForOfferCombo,
  formatOfferVariantLabel,
  OFFER_COMBOS,
  parseOfferAxesFromVariant,
} from "../lib/print-offer";

describe("print offer matrix", () => {
  it("defines nine Size × Finish × Framed combos", () => {
    expect(OFFER_COMBOS).toHaveLength(9);
    expect(OFFER_COMBOS.filter((c) => c.finishId === "archival_matte" && c.presentationId === "framed")).toHaveLength(
      3,
    );
    expect(OFFER_COMBOS.filter((c) => c.finishId === "rth_canvas")).toHaveLength(3);
    expect(OFFER_COMBOS.every((c) => c.finishId !== "rth_canvas" || c.presentationId === "unframed")).toBe(true);
  });

  it("builds nine priced drafts for a landscape master", () => {
    const drafts = buildOfferVariantsForProduct({
      pixelWidth: 6000,
      pixelHeight: 4000,
      editionSize: 10,
      mediaMarkupFactor: 3,
      mediaBasePriceAud: 0,
      frameMarkupFactor: 3,
      frameBasePriceAud: 0,
    });
    expect(drafts).toHaveLength(9);
    expect(new Set(drafts.map((d) => d.variant_label)).size).toBe(9);
    expect(drafts.every((d) => d.price_aud > 0 && d.lab_cost_aud > 0)).toBe(true);

    const framed = drafts.find((d) => d.combo.presentationId === "framed" && d.combo.sizeId === "medium")!;
    const unframed = drafts.find((d) => d.combo.presentationId === "unframed" && d.combo.sizeId === "medium" && d.combo.finishId === "archival_matte")!;
    expect(framed.price_aud).toBeGreaterThan(unframed.price_aud);
    expect(framed.is_framed).toBe(true);
    expect(framed.frame_type).toBe("standard_perspex");

    const canvas = drafts.find((d) => d.combo.finishId === "rth_canvas" && d.combo.sizeId === "medium")!;
    expect(canvas.is_framed).toBe(false);
    expect(canvas.print_type).toBe("canvas");
  });

  it("formats buyer labels without lab jargon", () => {
    expect(
      formatOfferVariantLabel({
        sizeId: "large",
        finishId: "archival_matte",
        presentationId: "framed",
      }),
    ).toBe("Large · Archival matte · Standard frame");
    expect(
      formatOfferVariantLabel({
        sizeId: "small",
        finishId: "rth_canvas",
        presentationId: "unframed",
      }),
    ).toBe("Small · Ready-to-hang canvas");
  });

  it("parses offer axes from variant metadata", () => {
    const axes = parseOfferAxesFromVariant({
      tier_label: "Medium",
      finish: "Archival matte",
      is_framed: true,
      variant_label: "Medium · Archival matte · Standard frame",
    });
    expect(axes).toEqual({
      sizeId: "medium",
      finishId: "archival_matte",
      presentationId: "framed",
    });
    const legacy = parseOfferAxesFromVariant({
      tier_label: "Medium",
      finish: "Archival matte",
      is_framed: true,
      variant_label: "Medium · Archival matte · Framed",
    });
    expect(legacy?.presentationId).toBe("framed");
  });

  it("resolves a combo from a variant list", () => {
    const drafts = buildOfferVariantsForProduct({
      pixelWidth: 4000,
      pixelHeight: 3000,
      editionSize: 5,
      mediaMarkupFactor: 3,
      mediaBasePriceAud: 0,
      frameMarkupFactor: 3,
      frameBasePriceAud: 0,
    });
    const asVariants = drafts.map((draft, index) => ({
      id: `v-${index}`,
      is_active: true,
      tier_label: draft.tier_label,
      finish: draft.finish,
      is_framed: draft.is_framed,
      variant_label: draft.variant_label,
    }));
    const match = findVariantForOfferCombo(asVariants, {
      sizeId: "small",
      finishId: "rth_canvas",
      presentationId: "unframed",
    });
    expect(match?.variant_label).toBe("Small · Ready-to-hang canvas");
  });
});

describe("offer pricing", () => {
  it("adds frame retail on top of matte media retail", () => {
    const unframed = computeOfferVariantPricing({
      widthMm: 594,
      heightMm: 420,
      finishId: "archival_matte",
      presentationId: "unframed",
      mediaMarkupFactor: 3,
      mediaBasePriceAud: 0,
      frameMarkupFactor: 3,
      frameBasePriceAud: 0,
    })!;
    const framed = computeOfferVariantPricing({
      widthMm: 594,
      heightMm: 420,
      finishId: "archival_matte",
      presentationId: "framed",
      mediaMarkupFactor: 3,
      mediaBasePriceAud: 0,
      frameMarkupFactor: 3,
      frameBasePriceAud: 0,
    })!;
    expect(framed.mediaLabAud).toBe(unframed.mediaLabAud);
    expect(framed.frameLabAud).toBeGreaterThan(0);
    expect(framed.retailAud).toBe(unframed.mediaRetailAud + framed.frameRetailAud);
  });

  it("prices canvas from RTH package without double-counting sq-in media", () => {
    const canvas = computeOfferVariantPricing({
      widthMm: 594,
      heightMm: 420,
      finishId: "rth_canvas",
      presentationId: "unframed",
      mediaMarkupFactor: 3,
      mediaBasePriceAud: 0,
      frameMarkupFactor: 3,
      frameBasePriceAud: 0,
    })!;
    expect(canvas.frameLabAud).toBe(0);
    expect(canvas.labCostAud).toBe(canvas.mediaLabAud);
    const uin = unitedInchesFromMm(594, 420);
    const band = lookupBandByUnitedInches(uin, SEED_RTH_CANVAS_RATES)!;
    expect(canvas.labCostAud).toBe(band.packageAud);
  });
});

describe("united-inch lookup", () => {
  it("rounds up to the next listed band", () => {
    expect(lookupBandByUnitedInches(65, SEED_FRAME_RATES)?.uin).toBe(67);
    expect(lookupBandByUnitedInches(67, SEED_FRAME_RATES)?.uin).toBe(67);
    expect(lookupBandByUnitedInches(20, SEED_FRAME_RATES)?.uin).toBe(20);
  });

  it("sums standard + perspex for frame lab cost", () => {
    const band = SEED_FRAME_RATES.find((row) => row.uin === 43)!;
    expect(frameLabCostAud(band)).toBe(Math.round((191.1 + 33.44) * 100) / 100);
  });
});
