import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { resolveCanonicalMediaPath } from "./media-storage";

const contentTypeByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const filenamePattern = /^[a-z0-9-]+\.[a-z0-9]+$/i;

export const buildMediaResponse = async (
  folder: "images" | "video",
  filename: string,
): Promise<NextResponse> => {
  if (!filenamePattern.test(filename) || filename.includes("/") || filename.includes("\\")) {
    return NextResponse.json({ error: "Invalid filename." }, { status: 400 });
  }

  const absolutePath = resolveCanonicalMediaPath(`${folder}/${filename}`);
  const extension = path.extname(filename).toLowerCase();
  const contentType = contentTypeByExtension[extension] ?? "application/octet-stream";

  try {
    const fileBuffer = await fs.readFile(absolutePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=14400",
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "Media file not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to read media file." }, { status: 500 });
  }
};
