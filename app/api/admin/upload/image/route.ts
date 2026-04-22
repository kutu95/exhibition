import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const extensionByMimeType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const fileField = formData.get("file");
  const altText = formData.get("alt_text");
  const usageNote = formData.get("usage_note");

  if (!(fileField instanceof File)) {
    return NextResponse.json({ error: "Image file is required." }, { status: 400 });
  }

  if (!ALLOWED_IMAGE_TYPES.has(fileField.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, and WEBP images are supported." }, { status: 400 });
  }

  if (fileField.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image exceeds 5MB limit." }, { status: 400 });
  }

  const extension = extensionByMimeType[fileField.type];
  const filename = `${randomUUID().toLowerCase()}${extension}`;
  const imagesDir = path.join(process.cwd(), "public", "images");
  const targetPath = path.join(imagesDir, filename);
  const buffer = Buffer.from(await fileField.arrayBuffer());

  await fs.mkdir(imagesDir, { recursive: true });
  await fs.writeFile(targetPath, buffer);

  const urlPath = `/images/${filename}`;
  const { data, error } = await supabaseAdmin
    .from("media_files")
    .insert({
      filename,
      original_filename: fileField.name,
      file_type: "image",
      mime_type: fileField.type,
      file_size_bytes: fileField.size,
      url_path: urlPath,
      width: null,
      height: null,
      duration_seconds: null,
      alt_text: typeof altText === "string" && altText.trim() ? altText.trim() : null,
      usage_note: typeof usageNote === "string" && usageNote.trim() ? usageNote.trim() : null,
    })
    .select("id")
    .single();

  if (error || !data) {
    await fs.unlink(targetPath).catch(() => undefined);
    return NextResponse.json({ error: error?.message ?? "Failed to save media metadata." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    url_path: urlPath,
    media_file_id: data.id,
  });
}
