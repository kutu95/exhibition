import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { prepareAdminPrintFile } from "../../../../../../lib/admin-print-prepare";
import { getMasterFileDimensions } from "../../../../../../lib/master-files";
import {
  CUSTOM_LONG_EDGE_MAX_MM,
  CUSTOM_LONG_EDGE_MIN_MM,
  deriveCustomSizeFromLongEdge,
} from "../../../../../../lib/print-custom";
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

type VariantMasterRow = {
  master_filename: string | null;
  width_mm: number | null;
  height_mm: number | null;
};

const bodySchema = z
  .object({
    long_edge_mm: z.number().min(CUSTOM_LONG_EDGE_MIN_MM).max(CUSTOM_LONG_EDGE_MAX_MM).optional(),
    width_mm: z.number().positive().max(CUSTOM_LONG_EDGE_MAX_MM).optional(),
    height_mm: z.number().positive().max(CUSTOM_LONG_EDGE_MAX_MM).optional(),
    pixel_width: z.number().int().positive().optional(),
    pixel_height: z.number().int().positive().optional(),
  })
  .refine(
    (value) =>
      typeof value.long_edge_mm === "number" ||
      (typeof value.width_mm === "number" && typeof value.height_mm === "number"),
    { message: "Provide long_edge_mm or both width_mm and height_mm." },
  );

export async function POST(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: productId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid custom print prepare request." }, { status: 400 });
  }

  const [{ data: product, error: productError }, { data: variants, error: variantsError }] =
    await Promise.all([
      supabaseAdmin.from("products").select("id, slug, product_type").eq("id", productId).maybeSingle(),
      supabaseAdmin
        .from("product_variants")
        .select("master_filename, width_mm, height_mm")
        .eq("product_id", productId),
    ]);

  if (productError || !product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }
  if (variantsError) {
    return NextResponse.json({ error: "Could not load product variants." }, { status: 500 });
  }

  const productRow = product as ProductRow;
  if (productRow.product_type !== "print") {
    return NextResponse.json({ error: "Only print products support print-file preparation." }, { status: 400 });
  }

  const variantRows = (variants ?? []) as VariantMasterRow[];
  const masterFilename =
    variantRows.find((variant) => variant.master_filename)?.master_filename ?? null;
  if (!masterFilename) {
    return NextResponse.json({ error: "Product has no master_filename." }, { status: 400 });
  }

  let widthMm = parsed.data.width_mm ?? 0;
  let heightMm = parsed.data.height_mm ?? 0;

  if (typeof parsed.data.long_edge_mm === "number") {
    let pixelWidth = parsed.data.pixel_width ?? null;
    let pixelHeight = parsed.data.pixel_height ?? null;

    if (!pixelWidth || !pixelHeight) {
      const dims = await getMasterFileDimensions(masterFilename).catch(() => null);
      if (dims) {
        pixelWidth = dims.pixel_width;
        pixelHeight = dims.pixel_height;
      }
    }

    if (!pixelWidth || !pixelHeight) {
      const sample = variantRows.find(
        (variant) => variant.width_mm && variant.height_mm && variant.width_mm > 0 && variant.height_mm > 0,
      );
      pixelWidth = sample?.width_mm ?? null;
      pixelHeight = sample?.height_mm ?? null;
    }

    if (!pixelWidth || !pixelHeight) {
      return NextResponse.json(
        { error: "This print cannot be custom-sized (dimensions unavailable)." },
        { status: 400 },
      );
    }

    const size = deriveCustomSizeFromLongEdge(parsed.data.long_edge_mm, pixelWidth, pixelHeight);
    widthMm = size.width_mm;
    heightMm = size.height_mm;
  }

  if (!(widthMm > 0) || !(heightMm > 0)) {
    return NextResponse.json({ error: "Width and height must be positive." }, { status: 400 });
  }

  try {
    const file = await prepareAdminPrintFile({
      slug: productRow.slug,
      masterFilename,
      widthMm,
      heightMm,
      borderMm: 0,
      printDpi: 300,
      fitMode: "custom_size",
      cropOffset: 0,
    });

    return NextResponse.json({
      ok: true,
      filename: file.name,
      relative_path: file.relativePath,
      width_mm: widthMm,
      height_mm: heightMm,
      download_path: `/api/admin/products/${productId}/custom-print-file?width_mm=${Math.trunc(widthMm)}&height_mm=${Math.trunc(heightMm)}&mode=download`,
    });
  } catch (error) {
    console.error("Admin prepare-custom-print failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare print file." },
      { status: 500 },
    );
  }
}
