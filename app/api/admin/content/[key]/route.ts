import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import type { SiteContent } from "../../../../../lib/supabase/types";

type RouteContext = {
  params: Promise<{ key: string }>;
};

const updateSchema = z
  .object({
    content_value: z.string().nullable().optional(),
    media_file_id: z.union([z.string().uuid(), z.null()]).optional(),
  })
  .refine((value) => value.content_value !== undefined || value.media_file_id !== undefined, {
    message: "No fields provided to update.",
  });

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid content update payload." }, { status: 400 });
  }

  const { key } = await context.params;
  const updates: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.content_value !== undefined) {
    updates.content_value = parsed.data.content_value;
  }
  if (parsed.data.media_file_id !== undefined) {
    updates.media_file_id = parsed.data.media_file_id;
  }

  const { data, error } = await supabaseAdmin
    .from("site_content")
    .update(updates)
    .eq("content_key", key)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath("/");
  revalidatePath("/story");
  revalidatePath("/installations");
  revalidatePath("/visit");

  return NextResponse.json(data as SiteContent);
}
