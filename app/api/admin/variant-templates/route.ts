import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import type { VariantTemplate } from "../../../../lib/supabase/types";

const templateSchema = z
  .object({
    variant_label: z.string().min(1),
    width_mm: z.number().int().positive(),
    height_mm: z.number().int().positive(),
    border_mm: z.number().int().nonnegative(),
    paper_type: z.string().min(1),
    print_type: z.string().min(1),
    base_price_aud: z.number().int().nonnegative(),
    sort_order: z.number().int(),
    is_active: z.boolean(),
    source_print_profile_id: z.string().uuid().nullable(),
    destination_print_profile_id: z.string().uuid().nullable(),
    tier_label: z.string().nullable(),
    finish: z.string().nullable(),
    is_framed: z.boolean(),
    frame_type: z.string().nullable(),
    print_dpi: z.number().int().positive(),
    lab_cost_aud: z.number().int().nonnegative().nullable(),
    suggested_retail_min_aud: z.number().int().nonnegative().nullable(),
    suggested_retail_max_aud: z.number().int().nonnegative().nullable(),
    turnaround_days_min: z.number().int().positive().nullable(),
    turnaround_days_max: z.number().int().positive().nullable(),
    shipping_class: z.string().nullable(),
    fulfilment_notes: z.string().nullable(),
    aspect_ratio: z.string().nullable(),
    canvas_wrap_mm: z.number().int().nonnegative().nullable(),
    wrap_style: z.string().nullable(),
    front_face_width_mm: z.number().int().positive().nullable(),
    front_face_height_mm: z.number().int().positive().nullable(),
    edition_size: z.number().int().positive().nullable(),
  })
  .strict();

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("variant_templates")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as VariantTemplate[]);
}

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = templateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid variant template payload." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("variant_templates")
    .insert(parsed.data)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as VariantTemplate, { status: 201 });
}
