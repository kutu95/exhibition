import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const extensionByMimeType: Record<string, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
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
    return NextResponse.json({ error: "Video file is required." }, { status: 400 });
  }

  if (!ALLOWED_VIDEO_TYPES.has(fileField.type)) {
    return NextResponse.json({ error: "Only MP4 and WEBM videos are supported." }, { status: 400 });
  }

  if (fileField.size > MAX_VIDEO_BYTES) {
    return NextResponse.json({ error: "Video exceeds 100MB limit." }, { status: 400 });
  }

  const extension = extensionByMimeType[fileField.type];
  const filename = `${randomUUID().toLowerCase()}${extension}`;
  const videoDir = path.join(process.cwd(), "public", "video");
  const targetPath = path.join(videoDir, filename);
  const buffer = Buffer.from(await fileField.arrayBuffer());

  await fs.mkdir(videoDir, { recursive: true });
  await fs.writeFile(targetPath, buffer);

  const urlPath = `/video/${filename}`;
  const { data, error } = await supabaseAdmin
    .from("media_files")
    .insert({
      filename,
      original_filename: fileField.name,
      file_type: "video",
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
