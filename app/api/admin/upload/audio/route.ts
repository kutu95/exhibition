import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { transcribeSpokenStory } from "../../../../../lib/audio-transcript";
import { resolveCanonicalMediaPath } from "../../../../../lib/media-storage";
import {
  audioStemFromProduct,
  extensionForAudioUpload,
  formatAudioClock,
  productAudioUrl,
} from "../../../../../lib/photo-audio";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const mimeTypeForExtension: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  wav: "audio/wav",
  webm: "audio/webm",
};

const parseDurationSeconds = (value: FormDataEntryValue | null): number | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const fileField = formData.get("file");
  const slug = typeof formData.get("slug") === "string" ? formData.get("slug") : "";
  const title = typeof formData.get("title") === "string" ? formData.get("title") : "";
  const liveTranscript =
    typeof formData.get("live_transcript") === "string" ? String(formData.get("live_transcript")).trim() : "";

  if (!(fileField instanceof File)) {
    return NextResponse.json({ error: "Audio file is required." }, { status: 400 });
  }

  if (fileField.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio exceeds the 25MB limit." }, { status: 400 });
  }

  const stem = audioStemFromProduct(String(slug), String(title));
  if (!stem) {
    return NextResponse.json({ error: "Add a product title or slug before saving audio." }, { status: 400 });
  }

  const extension = extensionForAudioUpload(fileField);
  if (!extension) {
    return NextResponse.json(
      { error: "Use an MP3, M4A, OGG, WAV, or WEBM recording." },
      { status: 400 },
    );
  }

  const filename = `${stem}.${extension}`;
  const relativePath = `audio/${filename}`;
  const targetPath = resolveCanonicalMediaPath(relativePath);
  const buffer = Buffer.from(await fileField.arrayBuffer());

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, buffer);

  const durationSeconds = parseDurationSeconds(formData.get("duration_seconds"));
  const duration = durationSeconds !== null ? formatAudioClock(durationSeconds) : null;
  const urlPath = productAudioUrl(stem, extension);

  const transcription = await transcribeSpokenStory({
    buffer,
    filename,
    mimeType: mimeTypeForExtension[extension] ?? fileField.type ?? "application/octet-stream",
  });

  const transcript = transcription.ok ? transcription.text : liveTranscript || null;

  return NextResponse.json({
    success: true,
    url_path: urlPath,
    duration,
    transcript,
    transcript_source: transcription.ok ? "whisper" : liveTranscript ? "browser" : "none",
    transcript_error: transcription.ok ? null : transcription.error,
  });
}
