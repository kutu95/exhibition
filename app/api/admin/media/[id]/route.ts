import fs from "node:fs/promises";

import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { resolveServedMediaPath } from "../../../../../lib/media-storage";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import type { MediaFile } from "../../../../../lib/supabase/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateSchema = z
  .object({
    alt_text: z.string().nullable().optional(),
    usage_note: z.string().nullable().optional(),
  })
  .refine((value) => value.alt_text !== undefined || value.usage_note !== undefined, {
    message: "No fields provided to update.",
  });

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid media update payload." }, { status: 400 });
  }

  const { id } = await context.params;
  const updates: Record<string, string | null> = {};

  if (parsed.data.alt_text !== undefined) {
    updates.alt_text = parsed.data.alt_text?.trim() ?? null;
  }
  if (parsed.data.usage_note !== undefined) {
    updates.usage_note = parsed.data.usage_note?.trim() ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from("media_files")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as MediaFile);
}

export async function DELETE(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const { data: media, error: getError } = await supabaseAdmin
    .from("media_files")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (getError) {
    return NextResponse.json({ error: getError.message }, { status: 500 });
  }
  if (!media) {
    return NextResponse.json({ error: "Media file not found." }, { status: 404 });
  }

  const relativeFilePath = media.url_path.replace(/^\/+/, "");
  const absoluteFilePath = await resolveServedMediaPath(relativeFilePath);

  await fs.unlink(absoluteFilePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });

  const { error: clearContentError } = await supabaseAdmin
    .from("site_content")
    .update({ media_file_id: null, content_value: "" })
    .eq("media_file_id", id);

  if (clearContentError) {
    return NextResponse.json({ error: clearContentError.message }, { status: 500 });
  }

  const { error: deleteError } = await supabaseAdmin.from("media_files").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
