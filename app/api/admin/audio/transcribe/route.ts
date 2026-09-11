import fs from "node:fs/promises";

import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { transcribeSpokenStory } from "../../../../../lib/audio-transcript";
import { resolveReadableMediaPath } from "../../../../../lib/media-storage";
import {
  audioFilenameFromUrl,
  isValidAudioUrl,
  mimeTypeForAudioUrl,
  relativePathFromAudioUrl,
} from "../../../../../lib/photo-audio";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const transcribeSchema = z.object({
  audio_url: z.string().min(1),
});

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = transcribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Audio URL is required." }, { status: 400 });
    }

    const audioUrl = parsed.data.audio_url.trim();
    const relativePath = relativePathFromAudioUrl(audioUrl);
    if (!isValidAudioUrl(audioUrl) || !relativePath) {
      return NextResponse.json({ error: "Audio URL must be a path like /audio/photo-name.mp3." }, { status: 400 });
    }

    const filePath = resolveReadableMediaPath(relativePath);
    let buffer: Buffer;
    try {
      buffer = await fs.readFile(filePath);
    } catch {
      return NextResponse.json({ error: "Audio file was not found on disk." }, { status: 404 });
    }

    if (buffer.byteLength > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio exceeds the 25MB limit." }, { status: 400 });
    }

    const filename = audioFilenameFromUrl(audioUrl);
    const transcription = await transcribeSpokenStory({
      buffer,
      filename,
      mimeType: mimeTypeForAudioUrl(audioUrl),
    });

    if (!transcription.ok) {
      return NextResponse.json({ error: transcription.error }, { status: 502 });
    }

    return NextResponse.json({ transcript: transcription.text });
  } catch (error) {
    return handleRouteError(error, "Admin audio transcribe failed");
  }
}
