import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import {
  DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
  getPrintPriceMarkupFactor,
  setPrintPriceMarkupFactor,
} from "../../../../../lib/print-markup";
import { PIXEL_PERFECT_PRICELIST_NOTE, PIXEL_PERFECT_SQ_IN_RATES_AUD } from "../../../../../lib/print-catalogue";

const markupSchema = z.object({
  markup_factor: z.number().min(1).max(20),
});

export async function GET(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const markupFactor = await getPrintPriceMarkupFactor();
    return NextResponse.json({
      markup_factor: markupFactor,
      default_markup_factor: DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
      rates: PIXEL_PERFECT_SQ_IN_RATES_AUD,
      rates_note: PIXEL_PERFECT_PRICELIST_NOTE,
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

    const parsed = markupSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Markup factor must be a number between 1 and 20." }, { status: 400 });
    }

    const markupFactor = await setPrintPriceMarkupFactor(parsed.data.markup_factor);
    return NextResponse.json({ markup_factor: markupFactor });
  } catch (error) {
    return handleRouteError(error, "Admin print markup PATCH failed");
  }
}
