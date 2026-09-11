import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import {
  DISCOUNT_PERCENTS,
  isDiscountCodeFormat,
  suggestDiscountCode,
} from "../../../../../lib/discount-codes";
import { siteConfig } from "../../../../../lib/metadata";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

const fillSchema = z.object({
  percent_off: z.number().refine((value): value is (typeof DISCOUNT_PERCENTS)[number] =>
    (DISCOUNT_PERCENTS as readonly number[]).includes(value),
  ),
});

const datesInclusive = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor.getTime() <= last.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
};

const uniqueSuggestedCode = (used: Set<string>): string => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const code = suggestDiscountCode();
    if (isDiscountCodeFormat(code) && !used.has(code)) {
      used.add(code);
      return code;
    }
  }
  throw new Error("Could not invent a unique board code. Try adding one by hand.");
};

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = fillSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose 10, 15, 20, or 25 percent." }, { status: 400 });
  }

  try {
    const { data: existing, error: listError } = await supabaseAdmin
      .from("discount_codes")
      .select("code, valid_on");

    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const usedDates = new Set((existing ?? []).map((row) => row.valid_on));
    const usedCodes = new Set((existing ?? []).map((row) => row.code));
    const missing = datesInclusive(siteConfig.exhibition.opens, siteConfig.exhibition.closes).filter(
      (date) => !usedDates.has(date),
    );

    if (missing.length === 0) {
      return NextResponse.json({ added: 0, codes: [] });
    }

    const rows = missing.map((valid_on) => ({
      code: uniqueSuggestedCode(usedCodes),
      valid_on,
      percent_off: parsed.data.percent_off,
    }));

    const { data, error } = await supabaseAdmin
      .from("discount_codes")
      .insert(rows)
      .select("id, code, valid_on, percent_off, created_at, updated_at");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ added: data?.length ?? 0, codes: data ?? [] }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Admin discount code fill failed");
  }
}
