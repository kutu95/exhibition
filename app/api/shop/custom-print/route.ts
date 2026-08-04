import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "../../../../lib/api-route-errors";
import { createCustomPrintVariant } from "../../../../lib/print-custom-variant";
import {
  CUSTOM_LONG_EDGE_MAX_MM,
  CUSTOM_LONG_EDGE_MIN_MM,
  SHOW_CUSTOM_PRINT_PAGE,
} from "../../../../lib/print-custom";

export const runtime = "nodejs";

const bodySchema = z.object({
  product_id: z.string().uuid(),
  long_edge_mm: z.number().min(CUSTOM_LONG_EDGE_MIN_MM).max(CUSTOM_LONG_EDGE_MAX_MM),
  media_id: z.string().min(1).max(80),
  frame_style: z.enum(["none", "standard_perspex", "deluxe_perspex"]),
  pixel_width: z.number().int().positive().optional(),
  pixel_height: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  try {
    if (!SHOW_CUSTOM_PRINT_PAGE) {
      return NextResponse.json({ error: "Custom print ordering is disabled." }, { status: 404 });
    }

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid custom print request." }, { status: 400 });
    }

    const created = await createCustomPrintVariant({
      productId: parsed.data.product_id,
      longEdgeMm: parsed.data.long_edge_mm,
      mediaId: parsed.data.media_id,
      frameStyle: parsed.data.frame_style,
      pixelWidth: parsed.data.pixel_width,
      pixelHeight: parsed.data.pixel_height,
    });

    return NextResponse.json({ ok: true, ...created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "PRODUCT_NOT_FOUND") {
        return NextResponse.json({ error: "Product not found." }, { status: 404 });
      }
      if (error.message === "PRODUCT_PIXELS_UNAVAILABLE") {
        return NextResponse.json(
          { error: "This print cannot be custom-sized (dimensions unavailable)." },
          { status: 400 },
        );
      }
      if (error.message === "CUSTOM_PRICE_UNAVAILABLE" || error.message === "INVALID_LONG_EDGE") {
        return NextResponse.json(
          { error: "That size, media, or frame combination cannot be priced online. Try a smaller size or simpler frame." },
          { status: 400 },
        );
      }
    }
    return handleRouteError(error, "Custom print variant create failed");
  }
}
