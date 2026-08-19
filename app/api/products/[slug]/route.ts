import { NextResponse } from "next/server";

import { isProductVisibleInCatalog, mapProductRow } from "../../../../lib/catalog-products";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import type {
  Product,
  ProductImage,
  ProductTheme,
  ProductVariant,
} from "../../../../lib/supabase/types";
import { allowedGalleryIdSet, getVaultSessionAccessFromRequest } from "../../../../lib/vault-access";

type ProductRow = Product & {
  product_variants: ProductVariant[] | null;
  product_images: ProductImage[] | null;
  product_themes: ProductTheme[] | null;
};

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const allowedGalleryIds = allowedGalleryIdSet(await getVaultSessionAccessFromRequest(request));
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, product_variants(*), product_images(*), product_themes(*, theme:themes(*))")
    .eq("slug", slug)
    .eq("is_available", true)
    .maybeSingle();

  if (error) {
    console.error("Product query failed", error);
    return NextResponse.json({ error: "Failed to fetch product." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const product = mapProductRow(data as ProductRow);
  if (!isProductVisibleInCatalog(product, allowedGalleryIds)) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  return NextResponse.json(product);
}
