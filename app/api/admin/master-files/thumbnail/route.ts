import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { resolveMasterFilePath, safeMasterFilename } from "../../../../../lib/master-files";
import { generateWebImageFromMaster } from "../../../../../lib/web-image-generation";

export const runtime = "nodejs";

const THUMB_MAX_EDGE = 480;
const THUMB_QUALITY = 72;

const thumbnailCachePath = (masterPath: string, modifiedMs: number): string => {
  const key = createHash("sha1").update(`${masterPath}:${modifiedMs}`).digest("hex");
  return path.join(os.tmpdir(), "exhibition-master-thumbs", `${key}.jpg`);
};

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const filenameParam = new URL(request.url).searchParams.get("filename");
  if (!filenameParam?.trim()) {
    return NextResponse.json({ error: "filename query parameter is required." }, { status: 400 });
  }

  let masterPath: string;
  try {
    const safeName = safeMasterFilename(filenameParam);
    masterPath = resolveMasterFilePath(safeName);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid master filename." },
      { status: 400 },
    );
  }

  try {
    const masterStat = await fs.stat(masterPath);
    const cachePath = thumbnailCachePath(masterPath, masterStat.mtimeMs);
    await fs.mkdir(path.dirname(cachePath), { recursive: true });

    let needsGenerate = true;
    try {
      const cacheStat = await fs.stat(cachePath);
      needsGenerate = cacheStat.mtimeMs < masterStat.mtimeMs || cacheStat.size === 0;
    } catch {
      needsGenerate = true;
    }

    if (needsGenerate) {
      await generateWebImageFromMaster(masterPath, cachePath, {
        maxEdge: THUMB_MAX_EDGE,
        quality: THUMB_QUALITY,
        timeoutMs: 90_000,
      });
    }

    const jpeg = await fs.readFile(cachePath);
    return new NextResponse(jpeg, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=300",
        "Content-Length": String(jpeg.byteLength),
      },
    });
  } catch (error) {
    console.error("Master thumbnail failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate thumbnail from master TIFF.",
      },
      { status: 500 },
    );
  }
}
