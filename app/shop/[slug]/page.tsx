import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetailClient } from "../../../components/ProductDetailClient";
import type { ProductWithVariantsAndImages } from "../../../lib/supabase/types";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3007";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function fetchProduct(slug: string): Promise<ProductWithVariantsAndImages | null> {
  try {
    const response = await fetch(`${siteUrl}/api/products/${slug}`, { cache: "no-store" });
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
  const product = await fetchProduct(slug);

  if (!product) {
    return {
      title: "Product not found",
    };
  }

  return {
    title: product.title,
    description: product.description ?? `Limited edition print from ${product.location_tag ?? "the exhibition"}.`,
    alternates: {
      canonical: `/shop/${slug}`,
    },
    openGraph: {
      type: "website",
      url: `${siteUrl}/shop/${slug}`,
      title: `${product.title} | SS Georgette Exhibition`,
      description:
        product.description ?? `Limited edition print from ${product.location_tag ?? "the exhibition"}.`,
      images: [{ url: product.product_images[0]?.image_url ?? "/images/placeholder-product.jpg" }],
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await fetchProduct(slug);

  if (!product) {
    notFound();
  }

  return <ProductDetailClient product={product} />;
}
