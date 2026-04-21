import type { MetadataRoute } from "next";

const siteUrl = "https://exhibition.margies.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    {
      url: `${siteUrl}/`,
      lastModified,
      priority: 1.0,
    },
    {
      url: `${siteUrl}/story`,
      lastModified,
      priority: 0.8,
    },
    {
      url: `${siteUrl}/installations`,
      lastModified,
      priority: 0.8,
    },
    {
      url: `${siteUrl}/shop`,
      lastModified,
      priority: 0.9,
    },
    {
      url: `${siteUrl}/visit`,
      lastModified,
      priority: 0.8,
    },
  ];
}
