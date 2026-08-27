import { describe, expect, it } from "vitest";

import {
  availableCustomPapers,
  availableCustomPresentations,
  formatCustomOfferVariantLabel,
  priceCustomOffer,
  customOfferVariantFields,
  type CustomOfferRates,
} from "../lib/print-custom-offer";
import { SEED_FRAME_RATES, SEED_RTH_CANVAS_RATES } from "../lib/print-frame-pricing";
import { SEED_POSTERFACTORY_CATALOGUE } from "../lib/posterfactory";
import {
  buildOfferVariantsForProduct,
  OFFER_SIZES,
  type OfferPaperId,
  type OfferPresentationId,
  type OfferSizeId,
} from "../lib/print-offer";

const rates: CustomOfferRates = {
  mediaMarkupFactor: 3,
  mediaBasePriceAud: 0,
  frameMarkupFactor: 3,
  frameBasePriceAud: 0,
  frameRates: SEED_FRAME_RATES,
  rthCanvasRates: SEED_RTH_CANVAS_RATES,
};

const PIXEL_WIDTH = 6000;
const PIXEL_HEIGHT = 4000;

const base = { pixelWidth: PIXEL_WIDTH, pixelHeight: PIXEL_HEIGHT, rates };

/** Buyer-facing axes and the fixed-size variant label they map to. */
const COMBOS: { paper: OfferPaperId; presentation: OfferPresentationId; classId: string }[] = [
  { paper: "tier1", presentation: "print", classId: "photographic" },
  { paper: "tier1", presentation: "mounted", classId: "photographic_mounted" },
  { paper: "tier1", presentation: "framed", classId: "framed" },
  { paper: "tier2", presentation: "print", classId: "fine_art" },
  { paper: "tier2", presentation: "mounted", classId: "fine_art_mounted" },
  { paper: "tier2", presentation: "framed", classId: "fine_art_framed" },
  { paper: "canvas", presentation: "print", classId: "canvas" },
  { paper: "canvas", presentation: "wrap", classId: "canvas_wrap" },
];

describe("custom prints priced on the shop's rate card", () => {
  const shopDrafts = buildOfferVariantsForProduct({
    pixelWidth: PIXEL_WIDTH,
    pixelHeight: PIXEL_HEIGHT,
    editionSize: 25,
    mediaMarkupFactor: rates.mediaMarkupFactor,
    mediaBasePriceAud: rates.mediaBasePriceAud,
    frameMarkupFactor: rates.frameMarkupFactor,
    frameBasePriceAud: rates.frameBasePriceAud,
    frameRates: rates.frameRates,
    rthCanvasRates: rates.rthCanvasRates,
  });

  it.each(OFFER_SIZES.map((size) => [size.id, size.longEdgeMm] as [OfferSizeId, number]))(
    "matches the %s shop price at the same long edge",
    (sizeId, longEdgeMm) => {
      for (const combo of COMBOS) {
        const shop = shopDrafts.find(
          (draft) => draft.combo.sizeId === sizeId && draft.combo.classId === combo.classId,
        );
        const custom = priceCustomOffer({
          ...base,
          longEdgeMm,
          paper: combo.paper,
          presentation: combo.presentation,
        });

        expect(custom, `${sizeId} ${combo.classId} should be priceable`).not.toBeNull();
        expect(
          custom!.retailCents,
          `${sizeId} ${combo.classId}: custom price must equal the fixed-size price`,
        ).toBe(shop!.price_aud);
        expect(custom!.widthMm).toBe(shop!.width_mm);
        expect(custom!.heightMm).toBe(shop!.height_mm);
      }
    },
  );

  it("prices sizes between the fixed sizes monotonically", () => {
    const a3 = priceCustomOffer({ ...base, longEdgeMm: 420, paper: "tier1", presentation: "print" })!;
    const between = priceCustomOffer({
      ...base,
      longEdgeMm: 500,
      paper: "tier1",
      presentation: "print",
    })!;
    const a2 = priceCustomOffer({ ...base, longEdgeMm: 594, paper: "tier1", presentation: "print" })!;

    expect(between.retailCents).toBeGreaterThan(a3.retailCents);
    expect(between.retailCents).toBeLessThan(a2.retailCents);
  });

  it("offers the same three papers as the storefront chooser", () => {
    expect(availableCustomPapers({ ...base, longEdgeMm: 420 })).toEqual([
      "tier1",
      "tier2",
      "canvas",
    ]);
  });

  it("offers print, mounted and framed on paper, rolled and stretched on canvas", () => {
    expect(availableCustomPresentations({ ...base, longEdgeMm: 420, paper: "tier1" })).toEqual([
      "print",
      "mounted",
      "framed",
    ]);
    expect(availableCustomPresentations({ ...base, longEdgeMm: 420, paper: "canvas" })).toEqual([
      "print",
      "wrap",
    ]);
  });

  it("drops framing once the print outgrows the widest moulding band", () => {
    const longEdgeMm = 3000;
    const presentations = availableCustomPresentations({ ...base, longEdgeMm, paper: "tier1" });
    expect(presentations).toContain("print");
    expect(presentations).not.toContain("framed");
    expect(
      priceCustomOffer({ ...base, longEdgeMm, paper: "tier1", presentation: "framed" }),
    ).toBeNull();
  });

  it("labels custom variants in buyer language", () => {
    expect(
      formatCustomOfferVariantLabel({
        widthMm: 594,
        heightMm: 396,
        paper: "tier2",
        presentation: "mounted",
      }),
    ).toBe("Custom 59 × 40 cm · Fine art rag · Mounted");
    expect(
      formatCustomOfferVariantLabel({
        widthMm: 500,
        heightMm: 333,
        paper: "canvas",
        presentation: "wrap",
      }),
    ).toBe("Custom 50 × 33 cm · Canvas · Stretched");
  });

  it("writes lab-facing variant columns without leaking buyer labels", () => {
    const quote = priceCustomOffer({
      ...base,
      longEdgeMm: 500,
      paper: "tier2",
      presentation: "framed",
    })!;
    const fields = customOfferVariantFields(quote, SEED_POSTERFACTORY_CATALOGUE);

    expect(fields.tier_label).toBe("Custom");
    expect(fields.finish).toBe("Tier 2 · Framed");
    expect(fields.paper_type).toBe("Canson Rag Photographique");
    expect(fields.print_type).toBe("fine_art");
    expect(fields.is_framed).toBe(true);
    expect(fields.fulfilment_provider).toBe("pixelperfect");
    expect(fields.fulfilment_class).toBe("framed");
    expect(fields.fulfilment_notes).toContain("lock long_edge 500mm");
    expect(fields.fulfilment_notes).toContain("Canson Rag Photographique");
  });

  it("keeps custom variants out of the fixed-size chooser", async () => {
    const { parseOfferAxesFromVariant } = await import("../lib/print-offer");
    const quote = priceCustomOffer({
      ...base,
      longEdgeMm: 500,
      paper: "tier1",
      presentation: "print",
    })!;
    const fields = customOfferVariantFields(quote, SEED_POSTERFACTORY_CATALOGUE);

    expect(parseOfferAxesFromVariant(fields)).toBeNull();
  });
});
