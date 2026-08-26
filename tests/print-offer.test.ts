import { describe, expect, it } from "vitest";

import { lookupBandByUnitedInches, SEED_RTH_CANVAS_RATES, unitedInchesFromMm } from "../lib/print-frame-pricing";
import {
  applyOfferSelection,
  buildOfferVariantsForProduct,
  computeOfferVariantPricing,
  findVariantForOfferCombo,
  formatOfferVariantLabel,
  OFFER_CLASS_PROVIDER,
  OFFER_COMBOS,
  parseOfferAxesFromVariant,
} from "../lib/print-offer";
import { SEED_POSTERFACTORY_CATALOGUE } from "../lib/posterfactory";

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
    expect(OFFER_COMBOS.filter((c) => c.classId === "photographic")).toHaveLength(3);
    expect(OFFER_COMBOS.filter((c) => c.classId === "fine_art")).toHaveLength(3);
    expect(OFFER_COMBOS.filter((c) => c.classId === "framed")).toHaveLength(3);
    expect(OFFER_COMBOS.filter((c) => c.classId === "canvas")).toHaveLength(3);
  });

  it("builds priced drafts with hidden suppliers", () => {
    const drafts = buildOfferVariantsForProduct({
      pixelWidth: 6000,
      pixelHeight: 4000,
      ...pricingArgs,
    });
    expect(drafts).toHaveLength(12);
    expect(new Set(drafts.map((d) => d.variant_label)).size).toBe(12);

    const photo = drafts.find((d) => d.combo.classId === "photographic" && d.combo.sizeId === "medium")!;
    const fineArt = drafts.find((d) => d.combo.classId === "fine_art" && d.combo.sizeId === "medium")!;
    const framed = drafts.find((d) => d.combo.classId === "framed" && d.combo.sizeId === "medium")!;
    const canvas = drafts.find((d) => d.combo.classId === "canvas" && d.combo.sizeId === "medium")!;

    expect(photo.fulfilment_provider).toBe("posterfactory");
    expect(photo.paper_type).toContain("Ilford Smooth Pearl");
    expect(photo.lab_cost_aud).toBe(Math.round(SEED_POSTERFACTORY_CATALOGUE.photographic.sizes.medium.supplierCostAud * 100));
    expect(photo.price_aud).toBe(10000);

    expect(fineArt.fulfilment_provider).toBe("pixelperfect");
    expect(fineArt.paper_type).toBe("Hahnemühle Photo Rag Pearl");
    expect(fineArt.price_aud).toBeGreaterThan(0);

    expect(framed.fulfilment_provider).toBe("posterfactory");
    expect(framed.is_framed).toBe(true);
    expect(framed.price_aud).toBeGreaterThan(photo.price_aud);

    expect(canvas.fulfilment_provider).toBe("pixelperfect");
    expect(canvas.print_type).toBe("canvas");
    expect(canvas.is_framed).toBe(false);
  });

  it("formats buyer labels without supplier names", () => {
    expect(formatOfferVariantLabel({ sizeId: "large", classId: "framed" })).toBe("Large · Framed Print");
    expect(formatOfferVariantLabel({ sizeId: "small", classId: "canvas" })).toBe("Small · Ready-to-hang canvas");
    expect(OFFER_CLASS_PROVIDER.fine_art).toBe("pixelperfect");
    expect(OFFER_CLASS_PROVIDER.photographic).toBe("posterfactory");
  });

  it("parses new and legacy variant metadata", () => {
    expect(
      parseOfferAxesFromVariant({
        fulfilment_class: "standard",
        tier_label: "Medium",
        variant_label: "Medium · Photographic Print",
      }),
    ).toEqual({ sizeId: "medium", classId: "photographic" });

    expect(
      parseOfferAxesFromVariant({
        tier_label: "Medium",
        finish: "Archival matte",
        is_framed: true,
        variant_label: "Medium · Archival matte · Standard frame",
      }),
    ).toEqual({ sizeId: "medium", classId: "framed" });

    expect(
      parseOfferAxesFromVariant({
        fulfilment_class: "framed",
        tier_label: "Medium",
        finish: "Archival matte",
        is_framed: false,
        variant_label: "Medium · Archival matte · Unframed",
      }),
    ).toEqual({ sizeId: "medium", classId: "fine_art" });
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
      sizeId: "small",
      classId: "canvas",
    });
    expect(match?.variant_label).toBe("Small · Ready-to-hang canvas");
  });

  it("applies a subset and optional retail override", () => {
    const drafts = buildOfferVariantsForProduct({
      pixelWidth: 6000,
      pixelHeight: 4000,
      ...pricingArgs,
    });
    const selected = applyOfferSelection(drafts, [
      { sizeId: "medium", classId: "photographic" },
      { sizeId: "medium", classId: "canvas", price_aud: 25000 },
    ]);
    expect(selected).toHaveLength(2);
    expect(selected[0]?.variant_label).toBe("Medium · Photographic Print");
    expect(selected[1]?.price_aud).toBe(25000);
    expect(applyOfferSelection(drafts, undefined)).toHaveLength(12);
    expect(() => applyOfferSelection(drafts, [])).toThrow("EMPTY_OFFER_SELECTION");
  });
});

describe("offer pricing", () => {
  it("uses PosterFactory package cost for photographic and framed", () => {
    const photo = computeOfferVariantPricing({
      widthMm: 594,
      heightMm: 420,
      classId: "photographic",
      sizeId: "medium",
      mediaMarkupFactor: 3,
      mediaBasePriceAud: 0,
      frameMarkupFactor: 3,
      frameBasePriceAud: 0,
    })!;
    expect(photo.labCostAud).toBe(32);
    expect(photo.retailAud).toBe(100);

    const framed = computeOfferVariantPricing({
      widthMm: 594,
      heightMm: 420,
      classId: "framed",
      sizeId: "small",
      mediaMarkupFactor: 3,
      mediaBasePriceAud: 0,
      frameMarkupFactor: 3,
      frameBasePriceAud: 0,
    })!;
    expect(framed.labCostAud).toBe(99);
    expect(framed.retailAud).toBe(300);
  });

  it("prices canvas from RTH package without double-counting sq-in media", () => {
    const canvas = computeOfferVariantPricing({
      widthMm: 594,
      heightMm: 420,
      classId: "canvas",
      sizeId: "medium",
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
