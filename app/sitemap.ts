import type { MetadataRoute } from "next";

import { siteConfig } from "../lib/metadata";
import { supabaseAdmin } from "../lib/supabase/admin";

type ProductSitemapRow = {
  slug: string;
  created_at: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Service role: public catalogue only — vault products must never appear.
  const { data: products, error } = await supabaseAdmin
    .from("products")
    .select("slug, created_at")
    .eq("is_available", true)
    .eq("visibility", "public");

  if (error) {
    console.error("Sitemap product query failed", error);
  }

  const productUrls = ((products ?? []) as ProductSitemapRow[]).map((product) => ({
    url: `${siteConfig.url}/shop/${product.slug}`,
    lastModified: new Date(product.created_at || Date.now()),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${siteConfig.url}/story`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteConfig.url}/installations`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteConfig.url}/shop`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteConfig.url}/visit`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...productUrls,
  ];
}
