import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import type { MediaFile } from "../../../../lib/supabase/types";

const mediaPathFromValue = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    return new URL(trimmed).pathname;
  } catch {
    return null;
  }
};

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [mediaResult, contentResult, productImagesResult] = await Promise.all([
    supabaseAdmin.from("media_files").select("*").order("uploaded_at", { ascending: false }),
    supabaseAdmin.from("site_content").select("content_key, content_value, media_file_id"),
    supabaseAdmin.from("product_images").select("image_url"),
  ]);

  const error = mediaResult.error ?? contentResult.error ?? productImagesResult.error;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const files = (mediaResult.data ?? []) as MediaFile[];
  const mediaIdByPath = new Map(files.map((file) => [file.url_path, file.id]));

  const contentKeysByMediaId = new Map<string, string[]>();
  const addContentKey = (mediaId: string, contentKey: string) => {
    const keys = contentKeysByMediaId.get(mediaId) ?? [];
    if (!keys.includes(contentKey)) {
      keys.push(contentKey);
      contentKeysByMediaId.set(mediaId, keys);
    }
  };

  for (const row of contentResult.data ?? []) {
    if (row.media_file_id) {
      addContentKey(row.media_file_id, row.content_key);
    }
    const path = mediaPathFromValue(row.content_value);
    if (!path) continue;
    const mediaId = mediaIdByPath.get(path);
    if (mediaId) {
      addContentKey(mediaId, row.content_key);
    }
  }

  const productImageCountsByPath = new Map<string, number>();
  for (const row of productImagesResult.data ?? []) {
    const path = mediaPathFromValue(row.image_url);
    if (!path) continue;
    productImageCountsByPath.set(path, (productImageCountsByPath.get(path) ?? 0) + 1);
  }

  const enriched = files.map((file) => ({
    ...file,
    usage: {
      site_content_keys: contentKeysByMediaId.get(file.id) ?? [],
      product_image_count: productImageCountsByPath.get(file.url_path) ?? 0,
    },
  }));

  return NextResponse.json(enriched as MediaFile[]);
}
