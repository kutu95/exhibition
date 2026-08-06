import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../../../lib/admin-auth";
import { findAdminPrintFile, prepareAdminPrintFile } from "../../../../../../../../lib/admin-print-prepare";
import { generateWebImageFromMaster } from "../../../../../../../../lib/web-image-generation";
import { supabaseAdmin } from "../../../../../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 600;

const PREVIEW_MAX_EDGE = 1600;
const PREVIEW_QUALITY = 82;

type RouteContext = {
  params: Promise<{ id: string; variantId: string }>;
};

type VariantRow = {
  id: string;
  product_id: string;
  master_filename: string | null;
  width_mm: number | null;
  height_mm: number | null;
  border_mm: number | null;
  print_dpi: number | null;
  fit_mode: string | null;
  crop_offset: number | null;
};

type ProductRow = {
  id: string;
  slug: string;
  product_type: string;
};

const previewCachePath = (filePath: string, modifiedMs: number): string => {
  const key = createHash("sha1").update(`${filePath}:${modifiedMs}`).digest("hex");
  return path.join(os.tmpdir(), "exhibition-admin-print-previews", `${key}.jpg`);
};

export async function GET(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: productId, variantId } = await context.params;
  const mode = new URL(request.url).searchParams.get("mode") === "preview" ? "preview" : "download";
  const prepareIfMissing = new URL(request.url).searchParams.get("prepare") === "1";

  const [{ data: product, error: productError }, { data: variant, error: variantError }] = await Promise.all([
    supabaseAdmin.from("products").select("id, slug, product_type").eq("id", productId).maybeSingle(),
    supabaseAdmin
      .from("product_variants")
      .select(
        "id, product_id, master_filename, width_mm, height_mm, border_mm, print_dpi, fit_mode, crop_offset",
      )
      .eq("id", variantId)
      .maybeSingle(),
  ]);

  if (productError || !product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  if (variantError || !variant) {
    return NextResponse.json({ error: "Variant not found." }, { status: 404 });
  }

  const productRow = product as ProductRow;
  const variantRow = variant as VariantRow;
  if (variantRow.product_id !== productRow.id) {
    return NextResponse.json({ error: "Variant does not belong to this product." }, { status: 400 });
  }
  if (!variantRow.width_mm || !variantRow.height_mm) {
    return NextResponse.json({ error: "Variant needs width_mm and height_mm." }, { status: 400 });
  }

  let local = await findAdminPrintFile(productRow.slug, variantRow.width_mm, variantRow.height_mm);
  if (!local && prepareIfMissing) {
    if (!variantRow.master_filename) {
      return NextResponse.json({ error: "Variant has no master_filename." }, { status: 400 });
    }
    try {
      local = await prepareAdminPrintFile({
        slug: productRow.slug,
        masterFilename: variantRow.master_filename,
        widthMm: variantRow.width_mm,
        heightMm: variantRow.height_mm,
        borderMm: variantRow.border_mm,
        printDpi: variantRow.print_dpi,
        fitMode: variantRow.fit_mode === "cover_crop" ? "cover_crop" : "custom_size",
        cropOffset: variantRow.crop_offset,
      });
    } catch (error) {
      console.error("Admin print-file prepare-on-get failed", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to prepare print file." },
        { status: 500 },
      );
    }
  }

  if (!local) {
    return NextResponse.json(
      { error: "Prepared admin print file not found. Use Prepare print file first." },
      { status: 404 },
    );
  }

  let fileStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    fileStat = await fs.stat(local.path);
  } catch {
    return NextResponse.json({ error: "Prepared print file is missing on disk." }, { status: 404 });
  }

  if (mode === "preview") {
    try {
      const cachePath = previewCachePath(local.path, fileStat.mtimeMs);
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      let needsGenerate = true;
      try {
        const cacheStat = await fs.stat(cachePath);
        needsGenerate = cacheStat.mtimeMs < fileStat.mtimeMs || cacheStat.size === 0;
      } catch {
        needsGenerate = true;
      }
      if (needsGenerate) {
        await generateWebImageFromMaster(local.path, cachePath, {
          maxEdge: PREVIEW_MAX_EDGE,
          quality: PREVIEW_QUALITY,
          timeoutMs: 180_000,
        });
      }
      const jpeg = await fs.readFile(cachePath);
      return new NextResponse(jpeg, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "private, max-age=120",
          "Content-Length": String(jpeg.byteLength),
        },
      });
    } catch (error) {
      console.error("Admin print preview failed", error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to preview print file." },
        { status: 500 },
      );
    }
  }

  const stream = createReadStream(local.path);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    status: 200,
    headers: {
      "Content-Type": "image/tiff",
      "Content-Disposition": `attachment; filename="${local.name.replace(/"/g, "")}"`,
      "Content-Length": String(fileStat.size),
      "Cache-Control": "private, no-store",
    },
  });
}
