import { describe, expect, it } from "vitest";

import {
  applyOfferSelection,
  blueWrenMountedLabAud,
  blueWrenPrintLabAud,
  buildOfferVariantsForProduct,
  classIdFromMediaPresentation,
  computeOfferVariantPricing,
  describeVariantForBuyer,
  findVariantForOfferCombo,
  formatOfferVariantLabel,
  mediaPresentationFromClassId,
  OFFER_CLASS_PROVIDER,
  OFFER_COMBOS,
  OFFER_MOUNT_LAB_MULTIPLIER,
  OFFER_PHOTOGRAPHIC_RATE_PER_SQ_IN,
  parseOfferAxesFromVariant,
  parseOfferSelectionPayload,
} from "../lib/print-offer";
import { mmToInches, computeRetailFromLabCost } from "../lib/print-size";
import { PRINT_PRICE_PER_PRINT_AUD } from "../lib/print-markup";

const pricingArgs = {
  editionSize: 10,
  mediaMarkupFactor: 3,
  mediaBasePriceAud: 0,
  frameMarkupFactor: 3,
  frameBasePriceAud: 0,
};

describe("print offer matrix", () => {
  it("defines thirty-two Size × product-class combos", () => {
    expect(OFFER_COMBOS).toHaveLength(32);
    expect(OFFER_COMBOS.filter((c) => c.classId === "photographic")).toHaveLength(4);
    expect(OFFER_COMBOS.filter((c) => c.classId === "photographic_mounted")).toHaveLength(4);
    expect(OFFER_COMBOS.filter((c) => c.classId === "fine_art")).toHaveLength(4);
    expect(OFFER_COMBOS.filter((c) => c.classId === "fine_art_mounted")).toHaveLength(4);
    expect(OFFER_COMBOS.filter((c) => c.classId === "framed")).toHaveLength(4);
    expect(OFFER_COMBOS.filter((c) => c.classId === "fine_art_framed")).toHaveLength(4);
    expect(OFFER_COMBOS.filter((c) => c.classId === "canvas")).toHaveLength(4);
    expect(OFFER_COMBOS.filter((c) => c.classId === "canvas_wrap")).toHaveLength(4);
  });

  it("maps media × finish to class ids", () => {
    expect(classIdFromMediaPresentation("tier1", "print")).toBe("photographic");
    expect(classIdFromMediaPresentation("tier1", "mounted")).toBe("photographic_mounted");
    expect(classIdFromMediaPresentation("tier1", "framed")).toBe("framed");
    expect(classIdFromMediaPresentation("tier2", "mounted")).toBe("fine_art_mounted");
    expect(classIdFromMediaPresentation("tier2", "framed")).toBe("fine_art_framed");
    expect(classIdFromMediaPresentation("canvas", "print")).toBe("canvas");
    expect(classIdFromMediaPresentation("canvas_wrap", "wrap")).toBe("canvas_wrap");
    expect(mediaPresentationFromClassId("canvas_wrap")).toEqual({
      media: "canvas_wrap",
      presentation: "wrap",
    });
    expect(mediaPresentationFromClassId("fine_art_framed")).toEqual({
      media: "tier2",
      presentation: "framed",
    });
  });

  it("builds priced drafts with Tier labels and hidden suppliers", () => {
    const drafts = buildOfferVariantsForProduct({
      pixelWidth: 6000,
      pixelHeight: 4000,
      ...pricingArgs,
    });
    expect(drafts.length).toBeGreaterThanOrEqual(24);
    expect(new Set(drafts.map((d) => d.variant_label)).size).toBe(drafts.length);

    const photo = drafts.find((d) => d.combo.classId === "photographic" && d.combo.sizeId === "a2")!;
    const mounted = drafts.find(
      (d) => d.combo.classId === "photographic_mounted" && d.combo.sizeId === "a2",
    )!;
    const fineArt = drafts.find((d) => d.combo.classId === "fine_art" && d.combo.sizeId === "a2")!;
    const canvas = drafts.find((d) => d.combo.classId === "canvas" && d.combo.sizeId === "a2")!;
    const wrap = drafts.find((d) => d.combo.classId === "canvas_wrap" && d.combo.sizeId === "a2")!;
    const framed = drafts.find((d) => d.combo.classId === "framed" && d.combo.sizeId === "a2")!;

    expect(photo.variant_label).toBe("A2 · Tier 1");
    expect(mounted.variant_label).toBe("A2 · Tier 1 · Mountboard");
    expect(mounted.lab_cost_aud).toBe(photo.lab_cost_aud * 2);
    expect(fineArt.variant_label).toBe("A2 · Tier 2");
    expect(canvas.variant_label).toBe("A2 · Canvas");
    expect(wrap.variant_label).toBe("A2 · Canvas · Image wrap");
    expect(wrap.price_aud).toBeGreaterThan(canvas.price_aud);
    expect(framed.is_framed).toBe(true);
    expect(OFFER_CLASS_PROVIDER.canvas_wrap).toBe("pixelperfect");
  });

  it("formats buyer labels without supplier names", () => {
    expect(formatOfferVariantLabel({ sizeId: "a0", classId: "framed" })).toBe("A0 · Tier 1 · Framed");
    expect(formatOfferVariantLabel({ sizeId: "a3", classId: "fine_art_framed" })).toBe(
      "A3 · Tier 2 · Framed",
    );
    expect(formatOfferVariantLabel({ sizeId: "a4", classId: "fine_art_mounted" })).toBe(
      "A4 · Tier 2 · Mountboard",
    );
  });

  it("parses new variant metadata", () => {
    expect(
      parseOfferAxesFromVariant({
        fulfilment_class: "standard",
        tier_label: "A3",
        finish: "Tier 1 · Mountboard",
        variant_label: "A3 · Tier 1 · Mountboard",
      }),
    ).toEqual({ sizeId: "a3", classId: "photographic_mounted" });

    expect(
      parseOfferAxesFromVariant({
        fulfilment_class: "canvas",
        tier_label: "A2",
        finish: "Canvas · Image wrap",
        variant_label: "A2 · Canvas · Image wrap",
        print_type: "canvas",
      }),
    ).toEqual({ sizeId: "a2", classId: "canvas_wrap" });
  });

  it("describes stored variants in buyer language", () => {
    expect(describeVariantForBuyer({ variant_label: "A3 · Tier 1" })).toBe(
      "A3 · Photographic · Print only",
    );
    expect(describeVariantForBuyer({ variant_label: "A4 · Tier 2 · Mountboard" })).toBe(
      "A4 · Fine art rag · Mounted",
    );
    expect(describeVariantForBuyer({ variant_label: "A2 · Canvas" })).toBe(
      "A2 · Canvas · Rolled",
    );
    expect(describeVariantForBuyer({ variant_label: "A2 · Canvas · Image wrap" })).toBe(
      "A2 · Canvas · Stretched",
    );
  });

  it("appends frame colour only for framed variants", () => {
    expect(describeVariantForBuyer({ variant_label: "A0 · Tier 1 · Framed" }, "black")).toBe(
      "A0 · Photographic · Framed · black frame",
    );
    expect(describeVariantForBuyer({ variant_label: "A0 · Tier 1" }, "black")).toBe(
      "A0 · Photographic · Print only",
    );
  });

    it("returns null for variants outside the offer matrix", () => {
      expect(describeVariantForBuyer({ variant_label: "600mm custom print" })).toBeNull();
    });

    it("adds the frame colour to custom labels, which are already buyer-facing", () => {
      expect(
        describeVariantForBuyer(
          { variant_label: "Custom 59 × 40 cm · Photographic · Framed" },
          "black",
        ),
      ).toBe("Custom 59 × 40 cm · Photographic · Framed · black frame");
      expect(
        describeVariantForBuyer({ variant_label: "Custom 59 × 40 cm · Canvas · Stretched" }, "black"),
      ).toBeNull();
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
      classId: "fine_art_mounted",
    });
    expect(match?.variant_label).toBe("A4 · Tier 2 · Mountboard");
  });

  it("applies a subset and optional retail override", () => {
    const drafts = buildOfferVariantsForProduct({
      pixelWidth: 6000,
      pixelHeight: 4000,
      ...pricingArgs,
    });
    const selected = applyOfferSelection(drafts, [
      { sizeId: "a2", classId: "photographic" },
      { sizeId: "a2", classId: "canvas_wrap", price_aud: 25000 },
    ]);
    expect(selected).toHaveLength(2);
    expect(selected[0]?.variant_label).toBe("A2 · Tier 1");
    expect(selected[1]?.price_aud).toBe(25000);
    expect(applyOfferSelection(drafts, undefined).length).toBe(drafts.length);
    expect(() => applyOfferSelection(drafts, [])).toThrow("EMPTY_OFFER_SELECTION");
  });

  it("accepts the full eight-class wizard matrix, including mounted and wrap SKUs", () => {
    const payload = OFFER_COMBOS.map((combo) => ({ ...combo }));
    expect(parseOfferSelectionPayload(payload)).toHaveLength(32);
    expect(
      parseOfferSelectionPayload([{ sizeId: "a2", classId: "photographic_mounted", price_aud: 18900 }]),
    ).toEqual([{ sizeId: "a2", classId: "photographic_mounted", price_aud: 18900 }]);
    expect(() => parseOfferSelectionPayload([{ sizeId: "a2", classId: "poster" }])).toThrow("UNKNOWN_OFFER_COMBO");
  });
});

describe("offer pricing", () => {
  it("adds $25 to every print on top of lab × markup", () => {
    const args = {
      widthMm: 594,
      heightMm: 420,
      classId: "photographic" as const,
      sizeId: "a2" as const,
      mediaMarkupFactor: 3,
      mediaBasePriceAud: 0,
      frameMarkupFactor: 3,
      frameBasePriceAud: 0,
    };
    const print = computeOfferVariantPricing(args)!;
    const markedUp = computeRetailFromLabCost(print.labCostAud, 3, 0);
    expect(print.retailAud).toBe(markedUp + PRINT_PRICE_PER_PRINT_AUD);

    const framed = computeOfferVariantPricing({ ...args, classId: "framed" })!;
    const framedMedia = computeRetailFromLabCost(framed.mediaLabAud, 3, 0);
    expect(framed.mediaRetailAud).toBe(framedMedia + PRINT_PRICE_PER_PRINT_AUD);
    expect(framed.retailAud).toBe(framed.mediaRetailAud + framed.frameRetailAud);
  });

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
    expect(photo.retailAud).toBe(computeRetailFromLabCost(expectedLab, 3, 0) + PRINT_PRICE_PER_PRINT_AUD);
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
  });

  it("doubles Blue Wren print cost for mounts", () => {
    const printLab = blueWrenPrintLabAud(594, 420, OFFER_PHOTOGRAPHIC_RATE_PER_SQ_IN);
    expect(blueWrenMountedLabAud(printLab)).toBe(
      Math.round(printLab * OFFER_MOUNT_LAB_MULTIPLIER * 100) / 100,
    );
    const mounted = computeOfferVariantPricing({
      widthMm: 594,
      heightMm: 420,
      classId: "photographic_mounted",
      sizeId: "a2",
      mediaMarkupFactor: 3,
      mediaBasePriceAud: 0,
      frameMarkupFactor: 3,
      frameBasePriceAud: 0,
    })!;
    expect(mounted.labCostAud).toBe(blueWrenMountedLabAud(printLab));
  });
});
