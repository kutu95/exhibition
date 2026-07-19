import fs from "node:fs/promises";

import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { resolveCanonicalMediaPath, resolveReadableMediaPath } from "../../../../../lib/media-storage";
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

const mediaPathMatches = (imageUrl: string | null | undefined, urlPath: string): boolean => {
  const trimmed = imageUrl?.trim();
  if (!trimmed) return false;
  if (trimmed === urlPath) return true;
  try {
    return new URL(trimmed).pathname === urlPath;
  } catch {
    return false;
  }
};

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

  const [contentByIdResult, contentRowsResult, productImagesResult] = await Promise.all([
    supabaseAdmin.from("site_content").select("content_key").eq("media_file_id", id),
    supabaseAdmin.from("site_content").select("content_key, content_value, media_file_id"),
    supabaseAdmin.from("product_images").select("image_url"),
  ]);

  const referenceError =
    contentByIdResult.error ?? contentRowsResult.error ?? productImagesResult.error;
  if (referenceError) {
    return NextResponse.json({ error: referenceError.message }, { status: 500 });
  }

  const contentKeys = new Set((contentByIdResult.data ?? []).map((row) => row.content_key));
  for (const row of contentRowsResult.data ?? []) {
    if (row.media_file_id === id) {
      contentKeys.add(row.content_key);
      continue;
    }
    if (mediaPathMatches(row.content_value, media.url_path)) {
      contentKeys.add(row.content_key);
    }
  }

  const productImageCount = (productImagesResult.data ?? []).filter((row) =>
    mediaPathMatches(row.image_url, media.url_path),
  ).length;

  if (contentKeys.size > 0 || productImageCount > 0) {
    const references = [
      contentKeys.size > 0 ? `site content: ${[...contentKeys].join(", ")}` : null,
      productImageCount > 0
        ? `${productImageCount} product image${productImageCount === 1 ? "" : "s"}`
        : null,
    ].filter(Boolean);
    return NextResponse.json(
      {
        error: `This file is in use by ${references.join(" and ")}. Replace or unlink it before deleting.`,
      },
      { status: 409 },
    );
  }

  const { data: deletedRows, error: deleteError } = await supabaseAdmin
    .from("media_files")
    .delete()
    .eq("id", id)
    .select("id");

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (!deletedRows || deletedRows.length === 0) {
    return NextResponse.json(
      {
        error:
          "Could not delete this media record from the database. Check that SUPABASE_SERVICE_ROLE_KEY is configured for admin writes.",
      },
      { status: 500 },
    );
  }

  const relativeFilePath = media.url_path.replace(/^\/+/, "");
  const absoluteFilePath = resolveReadableMediaPath(relativeFilePath);
  try {
    await fs.unlink(absoluteFilePath);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== "ENOENT") {
      console.error("Deleted media DB row but failed to remove file:", absoluteFilePath, err);
    }
  }

  // If the file also existed under the write target (shared vs public), remove that too.
  const writePath = resolveCanonicalMediaPath(relativeFilePath);
  if (writePath !== absoluteFilePath) {
    await fs.unlink(writePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") {
        console.error("Deleted media DB row but failed to remove write-target file:", writePath, error);
      }
    });
  }

  return NextResponse.json({ success: true, deleted_id: id });
}
