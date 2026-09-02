import type { MetadataRoute } from "next";

import { siteConfig } from "../lib/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/order/",
          "/cart",
          "/unsubscribe",
          "/collections/access",
          "/collections/request",
          "/shop/*/custom",
        ],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url.replace(/^https?:\/\//, ""),
  };
}
