import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import type {
  Product,
  ProductImage,
  ProductVariant,
  ProductWithVariantsAndImages,
} from "../../../../lib/supabase/types";

type ProductRow = Product & {
  product_variants: ProductVariant[] | null;
  product_images: ProductImage[] | null;
};

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { slug } = await context.params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, product_variants(*), product_images(*)")
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

  const product = data as ProductRow;

  const response: ProductWithVariantsAndImages = {
    ...product,
    product_variants: product.product_variants ?? [],
    product_images: (product.product_images ?? []).sort((a, b) => a.sort_order - b.sort_order),
  };

  return NextResponse.json(response);
}
