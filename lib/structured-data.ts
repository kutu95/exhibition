import type { ProductWithVariantsAndImages } from "./supabase/types";
import { siteConfig } from "./metadata";

export function buildExhibitionEvent(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    name: "The Georgette 150th",
    description: siteConfig.description,
    url: siteConfig.url,
    startDate: "2026-09-12",
    endDate: "2026-09-27",
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: "Margaret River Region Open Studios 2026",
      address: {
        "@type": "PostalAddress",
        addressRegion: "Western Australia",
        addressCountry: "AU",
        addressLocality: "Margaret River",
      },
    },
    organizer: {
      "@type": "Person",
      name: "John Bowskill",
      url: siteConfig.url,
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "AUD",
      availability: "https://schema.org/InStock",
      validFrom: new Date().toISOString(),
      description: "Free admission to the exhibition",
    },
    image: `${siteConfig.url}${siteConfig.ogImage.default}`,
    inLanguage: "en-AU",
  };
}

export function buildProduct(product: ProductWithVariantsAndImages): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || "",
    url: `${siteConfig.url}/shop/${product.slug}`,
    image: product.product_images.find((image) => image.is_primary)?.image_url || "",
    brand: {
      "@type": "Person",
      name: "John Bowskill",
    },
    offers: product.product_variants
      .filter((variant) => variant.is_active)
      .map((variant) => ({
        "@type": "Offer",
        name: variant.variant_label,
        price: (variant.price_aud / 100).toFixed(2),
        priceCurrency: "AUD",
        availability: "https://schema.org/InStock",
        seller: {
          "@type": "Person",
          name: "John Bowskill",
        },
      })),
  };
}

export function buildBreadcrumb(items: Array<{ name: string; path: string }>): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteConfig.url}${item.path}`,
    })),
  };
}
