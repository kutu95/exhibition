import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "../../../components/JsonLd";
import { ProductDetailClient } from "../../../components/ProductDetailClient";
import { ShareButtons } from "../../../components/ShareButtons";
import { isProductVisibleInCatalog, mapProductRow } from "../../../lib/catalog-products";
import { buildMetadata, siteConfig } from "../../../lib/metadata";
import { buildBreadcrumb, buildProduct } from "../../../lib/structured-data";
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

async function getProductBySlug(slug: string): Promise<ProductWithVariantsAndImages | null> {
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
  const description =
    product.description?.trim() ||
    `Limited edition archival print by John Bowskill. ${
      product.location_tag ? `${product.location_tag} series.` : ""
    } From $${(lowestPrice / 100).toFixed(0)} AUD.`.replace(/\s+/g, " ").trim();

  return buildMetadata({
    title: product.title,
    description,
    path: `/shop/${slug}`,
    ogImage: primaryImage?.image_url || siteConfig.ogImage.shop,
  });
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return (
    <>
      <JsonLd data={buildProduct(product)} />
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
    </>
  );
}
