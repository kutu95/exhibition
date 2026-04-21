import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type {
  LocationTag,
  Product,
  ProductImage,
  ProductVariant,
  ProductWithVariantsAndImages,
} from "../../../lib/supabase/types";

const productsQuerySchema = z.object({
  type: z.enum(["print", "merchandise"]).optional(),
  location: z.string().optional(),
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const locationSlugMap: Record<string, LocationTag> = {
  "calgarta-bay": "Calgardup Bay",
  "red-gate-beach": "Red Gate Beach",
  "isaac-rock": "Isaac Rock",
  "ss-georgette-wreck": "SS Georgette Wreck",
};

type ProductRow = Product & {
  product_variants: ProductVariant[] | null;
  product_images: ProductImage[] | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsedQuery = productsQuerySchema.safeParse({
    type: url.searchParams.get("type") ?? undefined,
    location: url.searchParams.get("location") ?? undefined,
    featured: url.searchParams.get("featured") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query params." }, { status: 400 });
  }

  const locationFilter = parsedQuery.data.location
    ? locationSlugMap[parsedQuery.data.location]
    : undefined;

  if (parsedQuery.data.location && !locationFilter) {
    return NextResponse.json({ error: "Invalid location filter." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("products")
    .select("*, product_variants(*), product_images(*)")
    .eq("is_available", true);

  if (parsedQuery.data.type) {
    query = query.eq("product_type", parsedQuery.data.type);
  }

  if (parsedQuery.data.featured === true) {
    query = query.eq("is_featured", true);
  }

  if (locationFilter) {
    query = query.eq("location_tag", locationFilter);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Products query failed", error);
    return NextResponse.json({ error: "Failed to fetch products." }, { status: 500 });
  }

  const products: ProductWithVariantsAndImages[] = ((data ?? []) as ProductRow[]).map(
    (product) => ({
      ...product,
      product_variants: (product.product_variants ?? []).filter((variant) => variant.is_active),
      product_images: (product.product_images ?? [])
        .filter((image) => image.is_primary)
        .sort((a, b) => a.sort_order - b.sort_order),
    }),
  );

  return NextResponse.json(products);
}
