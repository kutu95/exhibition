import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { JsonLd } from "../../../components/JsonLd";
import { PrintEditorial, type RelatedPrint } from "../../../components/PrintEditorial";
import { ProductDetailClient } from "../../../components/ProductDetailClient";
import { ShareButtons } from "../../../components/ShareButtons";
import { isProductVisibleInCatalog, mapProductRow } from "../../../lib/catalog-products";
import { buildMetadata, siteConfig } from "../../../lib/metadata";
import { getPlaceContext, getPrintEditorial, PRINT_EDITORIAL } from "../../../lib/print-editorial";
import { buildBreadcrumb, buildPhotographWork, buildProduct } from "../../../lib/structured-data";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type {
  Product,
  ProductImage,
  ProductTheme,
  ProductVariant,
  ProductWithVariantsAndImages,
} from "../../../lib/supabase/types";
import { hasActiveVaultSession } from "../../../lib/vault-access";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type ProductRow = Product & {
  product_variants: ProductVariant[] | null;
  product_images: ProductImage[] | null;
  product_themes: ProductTheme[] | null;
};

const getProductBySlug = cache(async (slug: string): Promise<ProductWithVariantsAndImages | null> => {
  const [supabase, includeVault] = await Promise.all([
    createSupabaseServerClient(),
    hasActiveVaultSession(),
  ]);

  const { data, error } = await supabase
    .from("products")
    .select("*, product_variants(*), product_images(*), product_themes(*, theme:themes(*))")
    .eq("slug", slug)
    .eq("is_available", true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const product = mapProductRow(data as ProductRow);
  if (!isProductVisibleInCatalog(product, includeVault)) {
    return null;
  }

  return product;
});

/** Sibling prints sharing the same place essay — the only inbound links these pages had was /shop. */
async function getRelatedPrints(slug: string): Promise<RelatedPrint[]> {
  const editorial = PRINT_EDITORIAL[slug];
  if (!editorial) return [];

  const siblingSlugs = Object.entries(PRINT_EDITORIAL)
    .filter(([otherSlug, other]) => otherSlug !== slug && other.place === editorial.place)
    .map(([otherSlug]) => otherSlug);

  if (siblingSlugs.length === 0) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug, title, product_images(image_url, is_primary, sort_order)")
    .in("slug", siblingSlugs)
    .eq("is_available", true)
    .eq("visibility", "public");

  if (error || !data) return [];

  return (data as Array<{ slug: string; title: string; product_images: ProductImage[] | null }>).map(
    (row) => {
      const images = [...(row.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      return {
        slug: row.slug,
        title: row.title,
        imageUrl: images.find((image) => image.is_primary)?.image_url ?? images[0]?.image_url ?? null,
      };
    },
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return buildMetadata({ title: "Print not found", noIndex: true });
  }

  const primaryImage =
    product.product_images.find((image) => image.is_primary) ?? product.product_images[0];
  const variantPrices = product.product_variants.map((variant) => variant.price_aud);
  const lowestPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;
  const place = getPlaceContext(slug);

  // Several catalogue descriptions are a single short sentence; pad them out to a
  // usable snippet length with the place and edition rather than shipping a 34-character
  // description Google will discard.
  const priceSuffix = lowestPrice > 0 ? ` from $${(lowestPrice / 100).toFixed(0)} AUD` : "";
  const description = [
    product.description?.trim(),
    place?.name ? `${place.name}.` : product.location_tag ? `${product.location_tag}.` : null,
    `Limited edition archival print by John Bowskill${priceSuffix}.`,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return buildMetadata({
    title: product.title,
    description,
    path: `/shop/${slug}`,
    ogImage: primaryImage?.image_url || siteConfig.ogImage.shop,
  });
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  // Resolve the product (and therefore the metadata that depends on it) before
  // flushing any HTML, so title/canonical land in <head> rather than after </head>.
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const editorial = getPrintEditorial(slug);
  const place = getPlaceContext(slug);
  const related = editorial ? await getRelatedPrints(slug) : [];

  return (
    <>
      <JsonLd data={buildProduct(product)} />
      <JsonLd data={buildPhotographWork(product, editorial?.caption ?? null, place?.name ?? null)} />
      <JsonLd
        data={buildBreadcrumb([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: product.title, path: `/shop/${product.slug}` },
        ])}
      />
      <Suspense fallback={<p className="section container">Loading print…</p>}>
        <ProductDetailClient
          product={product}
          shareButtons={
            <ShareButtons
              url={`${siteConfig.url}/shop/${product.slug}`}
              title={`${product.title} — The Georgette 150th`}
              description={product.description || ""}
            />
          }
        />
      </Suspense>
      {editorial ? (
        <PrintEditorial
          title={product.title}
          editorial={editorial}
          place={place}
          related={related}
        />
      ) : null}
    </>
  );
}
