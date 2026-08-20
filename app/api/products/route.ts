import { NextResponse } from "next/server";
import { z } from "zod";

import { applyCatalogVisibilityFilter, isProductVisibleInCatalog, mapProductRow } from "../../../lib/catalog-products";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type {
  Product,
  ProductImage,
  ProductTheme,
  ProductVariant,
  ProductWithVariantsAndImages,
} from "../../../lib/supabase/types";
import { slugify } from "../../../lib/utils/slugify";
import { allowedGalleryIdSet, getCatalogAccessFromRequest } from "../../../lib/vault-access";

const productsQuerySchema = z.object({
  type: z.enum(["print", "merchandise"]).optional(),
  location: z.string().optional(),
  theme: z.string().optional(),
  featured: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

type ProductRow = Product & {
  product_variants: ProductVariant[] | null;
  product_images: ProductImage[] | null;
  product_themes: ProductTheme[] | null;
};

const legacyLocationAliases: Record<string, string> = {
  "calgarta-bay": "Calgardup Bay",
  "red-gate-beach": "Redgate Beach",
  "isaac-rock": "Isaac Rock",
  "ss-georgette-wreck": "SS Georgette Wreck",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsedQuery = productsQuerySchema.safeParse({
    type: url.searchParams.get("type") ?? undefined,
    location: url.searchParams.get("location") ?? undefined,
    theme: url.searchParams.get("theme") ?? undefined,
    featured: url.searchParams.get("featured") ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query params." }, { status: 400 });
  }

  const access = await getCatalogAccessFromRequest(request);
  const allowedGalleryIds = allowedGalleryIdSet(access);
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("products")
    .select("*, product_variants(*), product_images(*), product_themes(*, theme:themes(*))")
    .eq("is_available", true);

  if (parsedQuery.data.type) {
    query = query.eq("product_type", parsedQuery.data.type);
  }

  if (parsedQuery.data.featured === true) {
    query = query.eq("is_featured", true);
  }

  query = applyCatalogVisibilityFilter(query, allowedGalleryIds);

  const { data, error } = await query
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Products query failed", error);
    return NextResponse.json({ error: "Failed to fetch products." }, { status: 500 });
  }

  let products: ProductWithVariantsAndImages[] = ((data ?? []) as unknown as ProductRow[])
    .map((product) => mapProductRow(product, { primaryImagesOnly: true }))
    .filter((product) => isProductVisibleInCatalog(product, allowedGalleryIds));

  if (parsedQuery.data.location) {
    const location = parsedQuery.data.location;
    const locationName = legacyLocationAliases[location] ?? location;
    products = products.filter(
      (product) =>
        product.location_tag === locationName ||
        (product.location_tag !== null && slugify(product.location_tag) === location),
    );
  }

  if (parsedQuery.data.theme) {
    products = products.filter((product) =>
      product.product_themes.some((assignment) => assignment.theme.slug === parsedQuery.data.theme),
    );
  }

  return NextResponse.json(products);
}
