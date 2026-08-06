import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { findAdminPrintFile } from "../../../../../../lib/admin-print-prepare";
import { CUSTOM_LONG_EDGE_MAX_MM } from "../../../../../../lib/print-custom";
import { supabaseAdmin } from "../../../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 600;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ProductRow = {
  id: string;
  slug: string;
  product_type: string;
};

const parsePositiveMm = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > CUSTOM_LONG_EDGE_MAX_MM) return null;
  return parsed;
};

export async function GET(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: productId } = await context.params;
  const url = new URL(request.url);
  const widthMm = parsePositiveMm(url.searchParams.get("width_mm"));
  const heightMm = parsePositiveMm(url.searchParams.get("height_mm"));
  const mode = url.searchParams.get("mode") === "preview" ? "preview" : "download";

  if (widthMm === null || heightMm === null) {
    return NextResponse.json({ error: "width_mm and height_mm query params are required." }, { status: 400 });
  }
  if (mode !== "download") {
    return NextResponse.json({ error: "Only mode=download is supported for custom print files." }, { status: 400 });
  }

  const { data: product, error: productError } = await supabaseAdmin
    .from("products")
    .select("id, slug, product_type")
    .eq("id", productId)
    .maybeSingle();

  if (productError || !product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const productRow = product as ProductRow;
  if (productRow.product_type !== "print") {
    return NextResponse.json({ error: "Only print products support print-file download." }, { status: 400 });
  }

  const local = await findAdminPrintFile(productRow.slug, widthMm, heightMm);
  if (!local) {
    return NextResponse.json(
      { error: "Prepared admin print file not found. Use Prepare & download print TIFF first." },
      { status: 404 },
    );
  }

  let fileStat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    fileStat = await fs.stat(local.path);
  } catch {
    return NextResponse.json({ error: "Prepared print file is missing on disk." }, { status: 404 });
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
