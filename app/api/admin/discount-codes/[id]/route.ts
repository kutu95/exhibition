import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import {
  DISCOUNT_PERCENTS,
  isDiscountCodeFormat,
  normalizeDiscountCode,
} from "../../../../../lib/discount-codes";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

const updateSchema = z.object({
  code: z.string().max(40),
  valid_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  percent_off: z.number().refine((value): value is (typeof DISCOUNT_PERCENTS)[number] =>
    (DISCOUNT_PERCENTS as readonly number[]).includes(value),
  ),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a date, a code, and 10, 15, 20, or 25 percent." }, { status: 400 });
  }

  const code = normalizeDiscountCode(parsed.data.code);
  if (!isDiscountCodeFormat(code)) {
    return NextResponse.json(
      { error: "Use 3–24 letters or numbers. Hyphens are fine in the middle." },
      { status: 400 },
    );
  }

  const { id } = await context.params;

  try {
    const { data, error } = await supabaseAdmin
      .from("discount_codes")
      .update({
        code,
        valid_on: parsed.data.valid_on,
        percent_off: parsed.data.percent_off,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, code, valid_on, percent_off, created_at, updated_at")
      .maybeSingle();

    if (error) {
      const duplicate = error.code === "23505";
      return NextResponse.json(
        {
          error: duplicate
            ? "That date already has a code, or that code is already used on another day."
            : error.message,
        },
        { status: duplicate ? 409 : 500 },
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Code not found." }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, "Admin discount code update failed");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { error } = await supabaseAdmin.from("discount_codes").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error, "Admin discount code delete failed");
  }
}
