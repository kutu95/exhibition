import type { MetadataRoute } from "next";

import { getPublishedHistoryPages } from "../lib/history-content";
import { siteConfig } from "../lib/metadata";
import { supabaseAdmin } from "../lib/supabase/admin";

type ProductSitemapRow = {
  slug: string;
  created_at: string | null;
};

/**
 * Bumped whenever the hand-written page copy / SEO surface changes.
 * A frozen `lastmod` tells Google there is nothing to recrawl.
 */
const staticLastMod = new Date("2026-08-10");

/** Regenerate so new prints appear without waiting for a redeploy. */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Service role: public catalogue only — vault products must never appear.
  // Explicit high range avoids accidental PostgREST max-rows truncation.
  const [{ data: products, error }, historyPages] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("slug, created_at")
      .eq("is_available", true)
      .eq("visibility", "public")
      .order("slug", { ascending: true })
      .range(0, 4999),
    getPublishedHistoryPages(),
  ]);

  if (error) {
    console.error("Sitemap product query failed", error);
  }

  const productRows = (products ?? []) as ProductSitemapRow[];
  if (!error && productRows.length === 0) {
    console.warn("Sitemap: zero public products returned — check Supabase connectivity.");
  }

  // Drafts have no `status: published`, so they are absent here as well as unroutable.
  // The /history hub is only listed while at least one research page is live.
  const historyUrls = historyPages.map((page) => ({
    url: `${siteConfig.url}/history/${page.slug}`,
    lastModified: new Date(page.updated),
    changeFrequency: "monthly" as const,
    priority: page.sitemapPriority,
  }));

  const historyHubUrl =
    historyPages.length > 0
      ? [
          {
            url: `${siteConfig.url}/history`,
            lastModified: staticLastMod,
            changeFrequency: "weekly" as const,
            priority: 0.85,
          },
        ]
      : [];

  const productUrls = productRows.map((product) => ({
    url: `${siteConfig.url}/shop/${product.slug}`,
    // Print pages carry hand-written editorial copy newer than many catalogue rows.
    lastModified: new Date(
      Math.max(
        new Date(product.created_at || staticLastMod).getTime(),
        staticLastMod.getTime(),
      ),
    ),
    changeFrequency: "monthly" as const,
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
      url: `${siteConfig.url}/book`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${siteConfig.url}/story`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...historyHubUrl,
    ...historyUrls,
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
    {
      url: `${siteConfig.url}/contact`,
      lastModified: staticLastMod,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    ...productUrls,
  ];
}
