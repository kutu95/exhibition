import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../../../lib/admin-auth";
import { prepareAdminPrintFile } from "../../../../../../../../lib/admin-print-prepare";
import { supabaseAdmin } from "../../../../../../../../lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 600;

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
  paper_type: string | null;
  finish: string | null;
  is_framed: boolean | null;
  frame_type: string | null;
  variant_label: string | null;
};

type ProductRow = {
  id: string;
  slug: string;
  title: string;
  product_type: string;
};

export async function POST(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: productId, variantId } = await context.params;

  const [{ data: product, error: productError }, { data: variant, error: variantError }] = await Promise.all([
    supabaseAdmin.from("products").select("id, slug, title, product_type").eq("id", productId).maybeSingle(),
    supabaseAdmin
      .from("product_variants")
      .select(
        "id, product_id, master_filename, width_mm, height_mm, border_mm, print_dpi, fit_mode, crop_offset, paper_type, finish, is_framed, frame_type, variant_label",
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

  if (productRow.product_type !== "print") {
    return NextResponse.json({ error: "Only print products support print-file preparation." }, { status: 400 });
  }
  if (variantRow.product_id !== productRow.id) {
    return NextResponse.json({ error: "Variant does not belong to this product." }, { status: 400 });
  }
  if (!variantRow.master_filename) {
    return NextResponse.json({ error: "Variant has no master_filename." }, { status: 400 });
  }
  if (!variantRow.width_mm || !variantRow.height_mm || variantRow.width_mm <= 0 || variantRow.height_mm <= 0) {
    return NextResponse.json({ error: "Variant needs positive width_mm and height_mm." }, { status: 400 });
  }

  try {
    const file = await prepareAdminPrintFile({
      slug: productRow.slug,
      masterFilename: variantRow.master_filename,
      widthMm: variantRow.width_mm,
      heightMm: variantRow.height_mm,
      borderMm: variantRow.border_mm,
      printDpi: variantRow.print_dpi,
      fitMode: variantRow.fit_mode === "cover_crop" ? "cover_crop" : "custom_size",
      cropOffset: variantRow.crop_offset,
    });

    return NextResponse.json({
      ok: true,
      filename: file.name,
      relative_path: file.relativePath,
      width_mm: variantRow.width_mm,
      height_mm: variantRow.height_mm,
      paper_type: variantRow.paper_type,
      finish: variantRow.finish,
      is_framed: variantRow.is_framed,
      frame_type: variantRow.frame_type,
      variant_label: variantRow.variant_label,
      download_path: `/api/admin/products/${productId}/variants/${variantId}/print-file?mode=download`,
      preview_path: `/api/admin/products/${productId}/variants/${variantId}/print-file?mode=preview`,
    });
  } catch (error) {
    console.error("Admin prepare-print failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare print file." },
      { status: 500 },
    );
  }
}
