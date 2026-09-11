import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "../../../../lib/api-route-errors";
import {
  DISCOUNT_INVALID_MESSAGE,
  findValidDiscountCode,
  normalizeDiscountCode,
} from "../../../../lib/discount-codes";

const bodySchema = z.object({
  code: z.string().max(40),
});

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: DISCOUNT_INVALID_MESSAGE }, { status: 400 });
    }

    const code = normalizeDiscountCode(parsed.data.code);
    if (!code) {
      return NextResponse.json({ ok: false, error: DISCOUNT_INVALID_MESSAGE }, { status: 400 });
    }

    const match = await findValidDiscountCode(code);
    if (!match) {
      return NextResponse.json({ ok: false, error: DISCOUNT_INVALID_MESSAGE }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      code: match.code,
      percent_off: match.percent_off,
    });
  } catch (error) {
    return handleRouteError(error, "Discount code validation failed");
  }
}
