import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { handleRouteError } from "../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { applyWallLabelProductFilters } from "../../../../lib/wall-qr-label-layout";
import { buildWallQrLabelsPdf, type WallQrLabelProduct } from "../../../../lib/wall-qr-labels";

export const runtime = "nodejs";
export const maxDuration = 60;

type ProductRow = {
  title: string | null;
  slug: string | null;
  location_tag: string | null;
  visibility: "public" | "vault" | null;
  product_type: string | null;
  is_available: boolean | null;
};

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("title, slug, location_tag, visibility, product_type, is_available")
      .eq("product_type", "print");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const products: WallQrLabelProduct[] = applyWallLabelProductFilters(
      ((data ?? []) as ProductRow[])
        .filter((product) => product.is_available !== false)
        .map((product) => ({
          title: product.title?.trim() ?? "",
          slug: product.slug?.trim() ?? "",
          location_tag: product.location_tag,
          visibility: product.visibility ?? "public",
        })),
      new URL(request.url).searchParams,
    );

    const pdf = buildWallQrLabelsPdf(products);
    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="wall-qr-labels-5cm-${date}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error, "Wall QR label PDF failed");
  }
}
