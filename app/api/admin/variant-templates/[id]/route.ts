import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import type { VariantTemplate } from "../../../../../lib/supabase/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateSchema = z
  .object({
    variant_label: z.string().min(1).optional(),
    width_mm: z.number().int().positive().optional(),
    height_mm: z.number().int().positive().optional(),
    border_mm: z.number().int().nonnegative().optional(),
    paper_type: z.string().min(1).optional(),
    print_type: z.string().min(1).optional(),
    base_price_aud: z.number().int().nonnegative().optional(),
    sort_order: z.number().int().optional(),
    is_active: z.boolean().optional(),
    source_print_profile_id: z.string().uuid().nullable().optional(),
    destination_print_profile_id: z.string().uuid().nullable().optional(),
    tier_label: z.string().nullable().optional(),
    finish: z.string().nullable().optional(),
    is_framed: z.boolean().optional(),
    frame_type: z.string().nullable().optional(),
    print_dpi: z.number().int().positive().optional(),
    lab_cost_aud: z.number().int().nonnegative().nullable().optional(),
    suggested_retail_min_aud: z.number().int().nonnegative().nullable().optional(),
    suggested_retail_max_aud: z.number().int().nonnegative().nullable().optional(),
    turnaround_days_min: z.number().int().positive().nullable().optional(),
    turnaround_days_max: z.number().int().positive().nullable().optional(),
    shipping_class: z.string().nullable().optional(),
    fulfilment_notes: z.string().nullable().optional(),
    aspect_ratio: z.string().nullable().optional(),
    canvas_wrap_mm: z.number().int().nonnegative().nullable().optional(),
    wrap_style: z.string().nullable().optional(),
    front_face_width_mm: z.number().int().positive().nullable().optional(),
    front_face_height_mm: z.number().int().positive().nullable().optional(),
    edition_size: z.number().int().positive().nullable().optional(),
  })
  .strict();

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid variant template profile payload." }, { status: 400 });
  }

  const { id } = await context.params;
  const { data, error } = await supabaseAdmin
    .from("variant_templates")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as VariantTemplate);
}

export async function DELETE(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { error } = await supabaseAdmin
    .from("variant_templates")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
