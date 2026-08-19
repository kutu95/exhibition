import { Suspense, cache } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { JsonLd } from "../../../components/JsonLd";
import { PrintEditorial } from "../../../components/PrintEditorial";
import { ProductDetailClient } from "../../../components/ProductDetailClient";
import { RelatedPrints } from "../../../components/RelatedPrints";
import { ShareButtons } from "../../../components/ShareButtons";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "../../../lib/admin-auth";
import { isProductVisibleInCatalog, mapProductRow } from "../../../lib/catalog-products";
import { buildMetadata, siteConfig } from "../../../lib/metadata";
import { getPlaceContext, getPrintEditorial } from "../../../lib/print-editorial";
import {
  pickRelatedPrints,
  type RelatedPrint,
  type RelatedPrintCandidate,
} from "../../../lib/related-prints";
import { buildBreadcrumb, buildPhotographWork, buildProduct } from "../../../lib/structured-data";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import type {
  Product,
  ProductImage,
  ProductTheme,
  ProductVariant,
  ProductWithVariantsAndImages,
} from "../../../lib/supabase/types";
import { allowedGalleryIdSet, getVaultSessionAccess } from "../../../lib/vault-access";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type ProductRow = Product & {
  product_variants: ProductVariant[] | null;
  product_images: ProductImage[] | null;
  product_themes: ProductTheme[] | null;
};

type RelatedRow = {
  slug: string;
  title: string;
  location_tag: string | null;
  photo_type_tag: string | null;
  created_at: string;
  product_images: Array<{
    image_url: string;
    is_primary: boolean;
    sort_order: number;
  }> | null;
  product_themes: Array<{
    theme_id: string;
    theme: { is_active: boolean } | Array<{ is_active: boolean }> | null;
  }> | null;
  product_variants: Array<{ master_filename: string | null; is_active: boolean | null }> | null;
};

const themeIsActive = (
  theme: { is_active: boolean } | Array<{ is_active: boolean }> | null | undefined,
): boolean => {
  if (!theme) return true;
  if (Array.isArray(theme)) return theme[0]?.is_active !== false;
  return theme.is_active !== false;
};

const toCandidate = (row: RelatedRow): RelatedPrintCandidate => {
  const images = [...(row.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const masterFilename =
    row.product_variants?.find((variant) => variant.master_filename)?.master_filename ?? null;

  return {
    slug: row.slug,
    title: row.title,
    location_tag: row.location_tag,
    photo_type_tag: row.photo_type_tag,
    created_at: row.created_at,
    master_filename: masterFilename,
    theme_ids: (row.product_themes ?? [])
      .filter((assignment) => themeIsActive(assignment.theme))
      .map((assignment) => assignment.theme_id),
    image_url: images.find((image) => image.is_primary)?.image_url ?? images[0]?.image_url ?? null,
  };
};

const getProductBySlug = cache(async (slug: string): Promise<ProductWithVariantsAndImages | null> => {
  const [supabase, access] = await Promise.all([
    createSupabaseServerClient(),
    getVaultSessionAccess(),
  ]);
  const allowedGalleryIds = allowedGalleryIdSet(access);

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
  if (!isProductVisibleInCatalog(product, allowedGalleryIds)) {
    return null;
  }

  return product;
});

async function getRelatedPrints(product: ProductWithVariantsAndImages): Promise<RelatedPrint[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "slug, title, location_tag, photo_type_tag, created_at, product_images(image_url, is_primary, sort_order), product_themes(theme_id, theme:themes(is_active)), product_variants(master_filename, is_active)",
    )
    .eq("is_available", true)
    .eq("visibility", "public")
    .eq("product_type", "print")
    .neq("slug", product.slug);

  if (error || !data) {
    console.error("Related prints query failed", error);
    return [];
  }

  const source: RelatedPrintCandidate = {
    slug: product.slug,
    title: product.title,
    location_tag: product.location_tag,
    photo_type_tag: product.photo_type_tag,
    created_at: product.created_at,
    master_filename:
      product.product_variants.find((variant) => variant.master_filename)?.master_filename ?? null,
    theme_ids: product.product_themes
      .filter((assignment) => assignment.theme?.is_active !== false)
      .map((assignment) => assignment.theme_id),
    image_url: product.product_images[0]?.image_url ?? null,
  };

  return pickRelatedPrints(source, (data as unknown as RelatedRow[]).map(toCandidate));
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
  const [related, cookieStore] = await Promise.all([getRelatedPrints(product), cookies()]);
  const isAdmin = await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

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
          isAdmin={isAdmin}
          shareButtons={
            <ShareButtons
              url={`${siteConfig.url}/shop/${product.slug}`}
              title={`${product.title} — The Georgette 150th`}
              description={product.description || ""}
            />
          }
        />
      </Suspense>
      {editorial ? <PrintEditorial title={product.title} editorial={editorial} place={place} /> : null}
      <RelatedPrints title={product.title} related={related} />
    </>
  );
}
