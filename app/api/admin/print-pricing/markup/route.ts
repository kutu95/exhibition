import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import {
  DEFAULT_PRINT_PRICE_BASE_AUD,
  DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
  getPrintPricingSettings,
  setPrintPricingSettings,
} from "../../../../../lib/print-markup";
import { getPrintPapers } from "../../../../../lib/print-papers";
import { PIXEL_PERFECT_PRICELIST_NOTE, PIXEL_PERFECT_SQ_IN_RATES_AUD } from "../../../../../lib/print-catalogue";

const pricingSchema = z.object({
  markup_factor: z.number().min(1).max(20),
  base_price_aud: z.number().min(0).max(100_000),
});

export async function GET(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [settings, papers] = await Promise.all([getPrintPricingSettings(), getPrintPapers()]);
    return NextResponse.json({
      markup_factor: settings.markupFactor,
      base_price_aud: settings.basePriceAud,
      default_markup_factor: DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
      default_base_price_aud: DEFAULT_PRINT_PRICE_BASE_AUD,
      rates: PIXEL_PERFECT_SQ_IN_RATES_AUD,
      rates_note: PIXEL_PERFECT_PRICELIST_NOTE,
      papers,
    });
  } catch (error) {
    return handleRouteError(error, "Admin print markup GET failed");
  }
}

export async function PATCH(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = pricingSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Markup must be 1–20 and base price must be 0 or more." },
        { status: 400 },
      );
    }

    const settings = await setPrintPricingSettings({
      markupFactor: parsed.data.markup_factor,
      basePriceAud: parsed.data.base_price_aud,
    });
    return NextResponse.json({
      markup_factor: settings.markupFactor,
      base_price_aud: settings.basePriceAud,
    });
  } catch (error) {
    return handleRouteError(error, "Admin print markup PATCH failed");
  }
}
