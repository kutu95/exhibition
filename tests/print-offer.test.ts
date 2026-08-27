import { describe, expect, it } from "vitest";

import { lookupBandByUnitedInches, SEED_RTH_CANVAS_RATES, unitedInchesFromMm } from "../lib/print-frame-pricing";
import {
  applyOfferSelection,
  blueWrenMountedLabAud,
  blueWrenPrintLabAud,
  buildOfferVariantsForProduct,
  computeOfferVariantPricing,
  findVariantForOfferCombo,
  formatOfferVariantLabel,
  OFFER_CLASS_PROVIDER,
  OFFER_COMBOS,
  OFFER_MOUNT_LAB_MULTIPLIER,
  OFFER_PHOTOGRAPHIC_RATE_PER_SQ_IN,
  parseOfferAxesFromVariant,
} from "../lib/print-offer";
import { mmToInches, computeRetailFromLabCost } from "../lib/print-size";

const pricingArgs = {
  editionSize: 10,
  mediaMarkupFactor: 3,
  mediaBasePriceAud: 0,
  frameMarkupFactor: 3,
  frameBasePriceAud: 0,
};

describe("print offer matrix", () => {
  it("defines twelve Size × product-class combos", () => {
    expect(OFFER_COMBOS).toHaveLength(12);
    expect(OFFER_COMBOS.filter((c) => c.classId === "photographic")).toHaveLength(4);
    expect(OFFER_COMBOS.filter((c) => c.classId === "fine_art")).toHaveLength(4);
    expect(OFFER_COMBOS.filter((c) => c.classId === "framed")).toHaveLength(4);
    expect(OFFER_COMBOS.filter((c) => c.classId === "canvas")).toHaveLength(0);
  });

  it("builds priced drafts with Tier labels and hidden suppliers", () => {
    const drafts = buildOfferVariantsForProduct({
      pixelWidth: 6000,
      pixelHeight: 4000,
      ...pricingArgs,
    });
    expect(drafts).toHaveLength(12);
    expect(new Set(drafts.map((d) => d.variant_label)).size).toBe(12);

    const photo = drafts.find((d) => d.combo.classId === "photographic" && d.combo.sizeId === "a2")!;
    const fineArt = drafts.find((d) => d.combo.classId === "fine_art" && d.combo.sizeId === "a2")!;
    const framed = drafts.find((d) => d.combo.classId === "framed" && d.combo.sizeId === "a2")!;

    expect(photo.fulfilment_provider).toBe("posterfactory");
    expect(photo.paper_type).toContain("Ilford Galerie Smooth Pearl");
    expect(photo.variant_label).toBe("A2 · Tier 1");
    expect(photo.finish).toBe("Tier 1");
    expect(photo.lab_cost_aud).toBeGreaterThan(0);
    expect(photo.price_aud).toBeGreaterThan(0);

    expect(fineArt.fulfilment_provider).toBe("pixelperfect");
    expect(fineArt.paper_type).toBe("Canson Rag Photographique");
    expect(fineArt.variant_label).toBe("A2 · Tier 2");
    expect(fineArt.price_aud).toBeGreaterThan(photo.price_aud);

    expect(framed.fulfilment_provider).toBe("posterfactory");
    expect(framed.is_framed).toBe(true);
    expect(framed.variant_label).toBe("A2 · Framed Print");
    expect(framed.price_aud).toBeGreaterThan(photo.price_aud);
  });

  it("formats buyer labels without supplier names", () => {
    expect(formatOfferVariantLabel({ sizeId: "a0", classId: "framed" })).toBe("A0 · Framed Print");
    expect(formatOfferVariantLabel({ sizeId: "a4", classId: "fine_art" })).toBe("A4 · Tier 2");
    expect(OFFER_CLASS_PROVIDER.fine_art).toBe("pixelperfect");
    expect(OFFER_CLASS_PROVIDER.photographic).toBe("posterfactory");
  });

  it("parses new and legacy variant metadata", () => {
    expect(
      parseOfferAxesFromVariant({
        fulfilment_class: "standard",
        tier_label: "A3",
        finish: "Tier 1",
        variant_label: "A3 · Tier 1",
      }),
    ).toEqual({ sizeId: "a3", classId: "photographic" });

    expect(
      parseOfferAxesFromVariant({
        fulfilment_class: "framed",
        tier_label: "A2",
        finish: "Framed Print",
        is_framed: true,
        variant_label: "A2 · Framed Print",
      }),
    ).toEqual({ sizeId: "a2", classId: "framed" });

    expect(
      parseOfferAxesFromVariant({
        fulfilment_class: "fine_art",
        tier_label: "A4",
        finish: "Tier 2",
        variant_label: "A4 · Tier 2",
      }),
    ).toEqual({ sizeId: "a4", classId: "fine_art" });
  });

  it("resolves a combo from a variant list", () => {
    const drafts = buildOfferVariantsForProduct({
      pixelWidth: 4000,
      pixelHeight: 3000,
      ...pricingArgs,
      editionSize: 5,
    });
    const asVariants = drafts.map((draft, index) => ({
      id: `v-${index}`,
      is_active: true,
      fulfilment_class: draft.fulfilment_class,
      tier_label: draft.tier_label,
      finish: draft.finish,
      is_framed: draft.is_framed,
      variant_label: draft.variant_label,
    }));
    const match = findVariantForOfferCombo(asVariants, {
      sizeId: "a4",
      classId: "fine_art",
    });
    expect(match?.variant_label).toBe("A4 · Tier 2");
  });

  it("applies a subset and optional retail override", () => {
    const drafts = buildOfferVariantsForProduct({
      pixelWidth: 6000,
      pixelHeight: 4000,
      ...pricingArgs,
    });
    const selected = applyOfferSelection(drafts, [
      { sizeId: "a2", classId: "photographic" },
      { sizeId: "a2", classId: "framed", price_aud: 25000 },
    ]);
    expect(selected).toHaveLength(2);
    expect(selected[0]?.variant_label).toBe("A2 · Tier 1");
    expect(selected[1]?.price_aud).toBe(25000);
    expect(applyOfferSelection(drafts, undefined)).toHaveLength(12);
    expect(() => applyOfferSelection(drafts, [])).toThrow("EMPTY_OFFER_SELECTION");
  });
});

describe("offer pricing", () => {
  it("prices Tier 1 from Blue Wren Smooth Pearl area rate", () => {
    const widthMm = 594;
    const heightMm = 420;
    const photo = computeOfferVariantPricing({
      widthMm,
      heightMm,
      classId: "photographic",
      sizeId: "a2",
      mediaMarkupFactor: 3,
      mediaBasePriceAud: 0,
      frameMarkupFactor: 3,
      frameBasePriceAud: 0,
    })!;
    const expectedLab =
      Math.round(mmToInches(widthMm) * mmToInches(heightMm) * OFFER_PHOTOGRAPHIC_RATE_PER_SQ_IN * 100) / 100;
    expect(photo.labCostAud).toBe(expectedLab);
    expect(photo.retailAud).toBe(computeRetailFromLabCost(expectedLab, 3, 0));
  });

  it("uses existing frame calculator plus Tier 1 media for framed", () => {
    const framed = computeOfferVariantPricing({
      widthMm: 420,
      heightMm: 297,
      classId: "framed",
      sizeId: "a3",
      mediaMarkupFactor: 3,
      mediaBasePriceAud: 0,
      frameMarkupFactor: 3,
      frameBasePriceAud: 0,
    })!;
    const mediaLab = blueWrenPrintLabAud(420, 297, OFFER_PHOTOGRAPHIC_RATE_PER_SQ_IN);
    expect(framed.mediaLabAud).toBe(mediaLab);
    expect(framed.frameLabAud).toBeGreaterThan(0);
    expect(framed.labCostAud).toBe(Math.round((mediaLab + framed.frameLabAud) * 100) / 100);
    expect(framed.retailAud).toBe(
      Math.round(
        (computeRetailFromLabCost(mediaLab, 3, 0) + framed.frameRetailAud) * 100,
      ) / 100,
    );
  });

  it("doubles Blue Wren print cost for mounts", () => {
    const printLab = blueWrenPrintLabAud(594, 420, OFFER_PHOTOGRAPHIC_RATE_PER_SQ_IN);
    expect(blueWrenMountedLabAud(printLab)).toBe(
      Math.round(printLab * OFFER_MOUNT_LAB_MULTIPLIER * 100) / 100,
    );
    expect(OFFER_MOUNT_LAB_MULTIPLIER).toBe(2);
  });

  it("prices canvas from RTH package without double-counting sq-in media", () => {
    const canvas = computeOfferVariantPricing({
      widthMm: 594,
      heightMm: 420,
      classId: "canvas",
      sizeId: "a2",
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
