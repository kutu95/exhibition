import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { verifyBearerApiKey } from "../../../../lib/api-key-auth";
import { resolveCanonicalMediaPath } from "../../../../lib/media-storage";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const JPEG_TYPES = new Set(["image/jpeg", "image/jpg"]);

const slugifyFilenamePart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export async function POST(request: Request) {
  if (!verifyBearerApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const fileField = formData.get("file");
  const slugField = formData.get("slug");

  if (!(fileField instanceof File)) {
    return NextResponse.json({ error: "JPEG file is required." }, { status: 400 });
  }

  if (typeof slugField !== "string" || !slugField.trim()) {
    return NextResponse.json({ error: "Product slug is required." }, { status: 400 });
  }

  if (!JPEG_TYPES.has(fileField.type)) {
    return NextResponse.json({ error: "Only JPEG images are supported." }, { status: 400 });
  }

  if (fileField.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image exceeds 5MB limit." }, { status: 400 });
  }

  const slug = slugifyFilenamePart(slugField) || "product";
  const filename = `${slug}-${randomUUID().toLowerCase()}.jpg`;
  const urlPath = `/images/${filename}`;
  const targetPath = resolveCanonicalMediaPath(urlPath);
  const buffer = Buffer.from(await fileField.arrayBuffer());

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);

  const { data, error } = await supabaseAdmin
    .from("media_files")
    .insert({
      filename,
      original_filename: fileField.name,
      file_type: "image",
      mime_type: "image/jpeg",
      file_size_bytes: fileField.size,
      url_path: urlPath,
      width: null,
      height: null,
      duration_seconds: null,
      alt_text: null,
      usage_note: `Photolab upload for ${slug}`,
    })
    .select("id")
    .single();

  if (error || !data) {
    await fs.unlink(targetPath).catch(() => undefined);
    return NextResponse.json({ error: error?.message ?? "Failed to save media metadata." }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const url = new URL(urlPath, siteUrl).toString();

  return NextResponse.json({
    ok: true,
    url,
    url_path: urlPath,
    media_file_id: data.id,
  });
}
