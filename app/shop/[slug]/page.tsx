import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { JsonLd } from "../../../components/JsonLd";
import { ProductDetailClient } from "../../../components/ProductDetailClient";
import { ShareButtons } from "../../../components/ShareButtons";
import { buildMetadata, siteConfig } from "../../../lib/metadata";
import { buildBreadcrumb, buildProduct } from "../../../lib/structured-data";
import type { ProductWithVariantsAndImages } from "../../../lib/supabase/types";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function fetchProductBySlug(slug: string): Promise<ProductWithVariantsAndImages | null> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    const response = await fetch(`${siteConfig.url}/api/products/${slug}`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ProductWithVariantsAndImages;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

  if (!product) {
    return buildMetadata({ title: "Print not found", noIndex: true });
  }

  const primaryImage = product.product_images.find((image) => image.is_primary);
  const variantPrices = product.product_variants.map((variant) => variant.price_aud);
  const lowestPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : 0;

  return buildMetadata({
    title: product.title,
    description:
      product.description ||
      `Limited edition archival print by John Bowskill. ${
        product.location_tag ? `${product.location_tag} series.` : ""
      } From $${(lowestPrice / 100).toFixed(0)} AUD.`,
    path: `/shop/${slug}`,
    ogImage: primaryImage?.image_url || siteConfig.ogImage.shop,
  });
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await fetchProductBySlug(slug);

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
