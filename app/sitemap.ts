import type { MetadataRoute } from "next";

import { siteConfig } from "../lib/metadata";
import { supabaseAdmin } from "../lib/supabase/admin";

type ProductSitemapRow = {
  slug: string;
  created_at: string | null;
};

const staticLastMod = new Date("2026-07-23");

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
    lastModified: new Date(product.created_at || staticLastMod),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [
    {
      url: siteConfig.url,
      lastModified: staticLastMod,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${siteConfig.url}/about-the-photographer`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${siteConfig.url}/story`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteConfig.url}/installations`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteConfig.url}/installations/cubarama`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${siteConfig.url}/installations/captain-godfrey`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${siteConfig.url}/installations/drift`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${siteConfig.url}/shop`,
      lastModified: staticLastMod,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteConfig.url}/visit`,
      lastModified: staticLastMod,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...productUrls,
  ];
}
