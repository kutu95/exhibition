import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { handleRouteError } from "../../../../lib/api-route-errors";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

type FavouriteRow = {
  product_id: string;
};

export async function GET(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: favourites, error: favouritesError } = await supabaseAdmin
      .from("product_favourites")
      .select("product_id");

    if (favouritesError) {
      return NextResponse.json({ error: favouritesError.message }, { status: 500 });
    }

    const counts = new Map<string, number>();
    ((favourites ?? []) as FavouriteRow[]).forEach((row) => {
      counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
    });

    const productIds = [...counts.keys()];
    const productMap = new Map<
      string,
      {
        title: string;
        slug: string;
        product_type: string;
        location_tag: string | null;
        is_available: boolean;
      }
    >();

    if (productIds.length > 0) {
      const { data: products, error: productsError } = await supabaseAdmin
        .from("products")
        .select("id,title,slug,product_type,location_tag,is_available")
        .in("id", productIds);

      if (productsError) {
        return NextResponse.json({ error: productsError.message }, { status: 500 });
      }

      (products ?? []).forEach((product) => {
        productMap.set(product.id, {
          title: product.title,
          slug: product.slug,
          product_type: product.product_type,
          location_tag: product.location_tag,
          is_available: product.is_available,
        });
      });
    }

    const byProduct = productIds
      .map((productId) => {
        const product = productMap.get(productId);
        return {
          product_id: productId,
          title: product?.title ?? "Unknown product",
          slug: product?.slug ?? "",
          product_type: product?.product_type ?? "print",
          location_tag: product?.location_tag ?? null,
          is_available: product?.is_available ?? false,
          favourite_count: counts.get(productId) ?? 0,
        };
      })
      .sort((a, b) => b.favourite_count - a.favourite_count || a.title.localeCompare(b.title));

    const totalFavourites = byProduct.reduce((sum, row) => sum + row.favourite_count, 0);

    return NextResponse.json({
      metrics: {
        total_favourites: totalFavourites,
        products_favourited: byProduct.length,
      },
      by_product: byProduct,
    });
  } catch (error) {
    return handleRouteError(error, "Admin favourites route failed");
  }
}
