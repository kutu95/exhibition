import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [{ data: products, error: productsError }, { data: images, error: imagesError }, { data: media, error: mediaError }] =
      await Promise.all([
        supabaseAdmin
          .from("products")
          .select("id, slug, title, is_available, product_type")
          .eq("product_type", "print")
          .order("title", { ascending: true }),
        supabaseAdmin
          .from("product_images")
          .select("product_id, image_url, alt_text, is_primary, sort_order")
          .order("sort_order", { ascending: true }),
        supabaseAdmin
          .from("media_files")
          .select("id, url_path, alt_text, width, height")
          .order("uploaded_at", { ascending: false })
          .limit(80),
      ]);

    if (productsError || imagesError || mediaError) {
      return NextResponse.json(
        { error: productsError?.message || imagesError?.message || mediaError?.message || "Assets failed." },
        { status: 500 },
      );
    }

    const imagesByProduct = new Map<
      string,
      Array<{ image_url: string; alt_text: string | null; is_primary: boolean | null }>
    >();
    for (const row of images ?? []) {
      const list = imagesByProduct.get(row.product_id) ?? [];
      list.push(row);
      imagesByProduct.set(row.product_id, list);
    }

    const productAssets = (products ?? []).map((product) => {
      const productImages = imagesByProduct.get(product.id) ?? [];
      const primary =
        productImages.find((image) => image.is_primary) ?? productImages[0] ?? null;
      return {
        id: product.id,
        slug: product.slug,
        title: product.title,
        is_available: product.is_available,
        image_url: primary?.image_url ?? null,
        alt_text: primary?.alt_text ?? null,
      };
    });

    return NextResponse.json({
      products: productAssets,
      media: (media ?? []).map((file) => ({
        id: file.id,
        url_path: file.url_path,
        alt_text: file.alt_text,
        width: file.width,
        height: file.height,
      })),
    });
  } catch (error) {
    return handleRouteError(error, "Admin campaign assets failed");
  }
}
