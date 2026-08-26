import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import {
  DEFAULT_PRINT_PRICE_BASE_AUD,
  DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
  setPrintPricingSettings,
} from "../../../../../lib/print-markup";
import {
  DEFAULT_PRINT_FRAME_BASE_AUD,
  DEFAULT_PRINT_FRAME_MARKUP_FACTOR,
  setFramePricingSettings,
  setFrameRates,
  setRthCanvasRates,
  type FrameRateBand,
  type RthCanvasRateBand,
} from "../../../../../lib/print-frame-pricing";
import { getOfferPricingBundle } from "../../../../../lib/print-offer-bundle";
import { OFFER_CLASSES, OFFER_COMBOS, OFFER_FINE_ART_PAPER_LABEL, OFFER_SIZES } from "../../../../../lib/print-offer";
import { setPosterFactoryCatalogue, type PosterFactoryCatalogue } from "../../../../../lib/posterfactory";

export async function GET(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bundle = await getOfferPricingBundle();
    return NextResponse.json({
      markup_factor: bundle.markupFactor,
      base_price_aud: bundle.basePriceAud,
      default_markup_factor: DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
      default_base_price_aud: DEFAULT_PRINT_PRICE_BASE_AUD,
      frame_markup_factor: bundle.frameMarkupFactor,
      frame_base_price_aud: bundle.frameBasePriceAud,
      default_frame_markup_factor: DEFAULT_PRINT_FRAME_MARKUP_FACTOR,
      default_frame_base_price_aud: DEFAULT_PRINT_FRAME_BASE_AUD,
      frame_rates: bundle.frameRates,
      rth_canvas_rates: bundle.rthCanvasRates,
      posterfactory: bundle.posterfactory,
      offer: {
        sizes: OFFER_SIZES,
        classes: OFFER_CLASSES,
        combo_count: OFFER_COMBOS.length,
        fine_art_paper: OFFER_FINE_ART_PAPER_LABEL,
      },
    });
  } catch (error) {
    return handleRouteError(error, "Admin print offer GET failed");
  }
}

const patchSchema = z.object({
  markup_factor: z.number().min(1).max(20).optional(),
  base_price_aud: z.number().min(0).max(100_000).optional(),
  frame_markup_factor: z.number().min(1).max(20).optional(),
  frame_base_price_aud: z.number().min(0).max(100_000).optional(),
  frame_rates: z
    .array(
      z.object({
        uin: z.number().min(1),
        standardAud: z.number().min(0),
        perspexAud: z.number().min(0),
      }),
    )
    .optional(),
  rth_canvas_rates: z
    .array(
      z.object({
        uin: z.number().min(1),
        packageAud: z.number().min(0),
      }),
    )
    .optional(),
  posterfactory: z
    .object({
      photographic: z.object({
        classId: z.literal("photographic"),
        label: z.string(),
        paper: z.string(),
        productCode: z.string(),
        productUrl: z.string(),
        sizes: z.object({
          small: z.object({
            supplierCostAud: z.number().min(0),
            retailPriceAud: z.number().min(0).nullable(),
            isActive: z.boolean(),
          }),
          medium: z.object({
            supplierCostAud: z.number().min(0),
            retailPriceAud: z.number().min(0).nullable(),
            isActive: z.boolean(),
          }),
          large: z.object({
            supplierCostAud: z.number().min(0),
            retailPriceAud: z.number().min(0).nullable(),
            isActive: z.boolean(),
          }),
        }),
      }),
      framed: z.object({
        classId: z.literal("framed"),
        label: z.string(),
        paper: z.string(),
        productCode: z.string(),
        productUrl: z.string(),
        sizes: z.object({
          small: z.object({
            supplierCostAud: z.number().min(0),
            retailPriceAud: z.number().min(0).nullable(),
            isActive: z.boolean(),
          }),
          medium: z.object({
            supplierCostAud: z.number().min(0),
            retailPriceAud: z.number().min(0).nullable(),
            isActive: z.boolean(),
          }),
          large: z.object({
            supplierCostAud: z.number().min(0),
            retailPriceAud: z.number().min(0).nullable(),
            isActive: z.boolean(),
          }),
        }),
      }),
    })
    .optional(),
});

export async function PATCH(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid offer pricing payload." }, { status: 400 });
    }

    const current = await getOfferPricingBundle();

    if (parsed.data.markup_factor !== undefined || parsed.data.base_price_aud !== undefined) {
      await setPrintPricingSettings({
        markupFactor: parsed.data.markup_factor ?? current.markupFactor,
        basePriceAud: parsed.data.base_price_aud ?? current.basePriceAud,
      });
    }

    if (parsed.data.frame_markup_factor !== undefined || parsed.data.frame_base_price_aud !== undefined) {
      await setFramePricingSettings({
        markupFactor: parsed.data.frame_markup_factor ?? current.frameMarkupFactor,
        basePriceAud: parsed.data.frame_base_price_aud ?? current.frameBasePriceAud,
      });
    }

    if (parsed.data.frame_rates) {
      await setFrameRates(parsed.data.frame_rates as FrameRateBand[]);
    }
    if (parsed.data.rth_canvas_rates) {
      await setRthCanvasRates(parsed.data.rth_canvas_rates as RthCanvasRateBand[]);
    }
    if (parsed.data.posterfactory) {
      await setPosterFactoryCatalogue(parsed.data.posterfactory as PosterFactoryCatalogue);
    }

    const bundle = await getOfferPricingBundle();
    return NextResponse.json({
      markup_factor: bundle.markupFactor,
      base_price_aud: bundle.basePriceAud,
      frame_markup_factor: bundle.frameMarkupFactor,
      frame_base_price_aud: bundle.frameBasePriceAud,
      frame_rates: bundle.frameRates,
      rth_canvas_rates: bundle.rthCanvasRates,
      posterfactory: bundle.posterfactory,
    });
  } catch (error) {
    return handleRouteError(error, "Admin print offer PATCH failed");
  }
}
