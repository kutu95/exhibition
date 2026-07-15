import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import type { PrintProfile } from "../../../../../lib/supabase/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateSchema = z
  .object({
    display_name: z.string().min(1).optional(),
    profile_role: z.enum(["source", "destination"]).optional(),
    colour_space: z.string().nullable().optional(),
    paper_type: z.string().nullable().optional(),
    print_type: z.string().nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .strict();

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "Invalid print profile update payload." }, { status: 400 });
  }

  const { id } = await context.params;
  const { data, error } = await supabaseAdmin
    .from("print_profiles")
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as PrintProfile);
}
