import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { handleRouteError } from "../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { buildWallCaptionLabelsPdf, type WallCaptionLabelProduct } from "../../../../lib/wall-caption-labels";
import { applyWallLabelProductFilters } from "../../../../lib/wall-qr-label-layout";

export const runtime = "nodejs";
export const maxDuration = 60;

type ProductRow = {
  title: string | null;
  slug: string | null;
  location_tag: string | null;
  description: string | null;
  audio_transcript: string | null;
  credit_attribution: string | null;
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
      .select(
        "title, slug, location_tag, description, audio_transcript, credit_attribution, visibility, product_type, is_available",
      )
      .eq("product_type", "print");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const products: WallCaptionLabelProduct[] = applyWallLabelProductFilters(
      ((data ?? []) as ProductRow[])
        .filter((product) => product.is_available !== false)
        .map((product) => ({
          title: product.title?.trim() ?? "",
          slug: product.slug?.trim() ?? "",
          location_tag: product.location_tag,
          description: product.description,
          audio_transcript: product.audio_transcript,
          credit_attribution: product.credit_attribution,
          visibility: product.visibility ?? "public",
        })),
      new URL(request.url).searchParams,
    );

    const pdf = buildWallCaptionLabelsPdf(products);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="wall-caption-labels.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error, "Wall caption label PDF failed");
  }
}
