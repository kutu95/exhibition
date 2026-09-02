import type { ProductWithVariantsAndImages } from "./supabase/types";
import { siteConfig } from "./metadata";
import { describeVariantForBuyer } from "./print-offer";

const logoUrl = `${siteConfig.url}/logo.png`;
const defaultImageUrl = `${siteConfig.url}${siteConfig.ogImage.default}`;

/** Profiles Google can use to reconcile the publisher and the artist as one entity. */
const socialProfiles = [siteConfig.social.facebook, siteConfig.social.instagram].filter(
  (href): href is string => Boolean(href),
);

function absoluteUrl(pathOrUrl: string): string {
  return pathOrUrl.startsWith("http") ? pathOrUrl : `${siteConfig.url}${pathOrUrl}`;
}

/**
 * The subject the whole site is about — reused so Google sees one consistent entity.
 *
 * Deliberately not `Vehicle`: schema.org files that under `Product`, so Search
 * Console judged the ship against Product snippets and failed it for having no
 * offers, review or aggregateRating. A wreck is not for sale. `sameAs` carries
 * the identity that the type no longer does.
 */
export function buildShipEntity(): Record<string, unknown> {
  return {
    "@type": "Thing",
    name: "SS Georgette",
    alternateName: "Georgette",
    description:
      "Iron screw-steamer built in 1872 at Dumbarton on the Clyde, wrecked off Redgate Beach in Calgardup Bay, Western Australia, on 1 December 1876.",
    sameAs: ["https://en.wikipedia.org/wiki/SS_Georgette", "https://www.wikidata.org/wiki/Q7393741"],
  };
}

function buildArtistPerson(): Record<string, unknown> {
  return {
    "@type": "Person",
    name: siteConfig.artist,
    url: `${siteConfig.url}/about-the-photographer`,
    ...(socialProfiles.length ? { sameAs: socialProfiles } : {}),
  };
}

function buildLogoImage() {
  return {
    "@type": "ImageObject",
    url: logoUrl,
    contentUrl: logoUrl,
    width: 512,
    height: 512,
    caption: `${siteConfig.name} logo`,
  };
}

function buildOgImageObject(caption?: string) {
  return {
    "@type": "ImageObject",
    url: defaultImageUrl,
    contentUrl: defaultImageUrl,
    width: 1200,
    height: 630,
    caption: caption || `${siteConfig.name} — photographic exhibition by ${siteConfig.artist}`,
  };
}

export function buildWebsite(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    alternateName: "SS Georgette 150th Anniversary Photographic Exhibition",
    url: siteConfig.url,
    description: siteConfig.description,
    inLanguage: "en-AU",
    image: buildOgImageObject(),
    about: buildShipEntity(),
    ...(socialProfiles.length ? { sameAs: socialProfiles } : {}),
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: buildLogoImage(),
      ...(socialProfiles.length ? { sameAs: socialProfiles } : {}),
    },
  };
}

export function buildHomeWebPage(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "The Georgette 150th Anniversary Photographic Exhibition | John Bowskill",
    description: siteConfig.description,
    url: siteConfig.url,
    isPartOf: {
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    about: {
      "@type": "ExhibitionEvent",
      name: siteConfig.name,
    },
    primaryImageOfPage: buildOgImageObject(),
    image: buildOgImageObject(),
    thumbnailUrl: defaultImageUrl,
    inLanguage: "en-AU",
  };
}

export function buildExhibitionEvent(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    name: "The Georgette 150th",
    alternateName: "SS Georgette 150th Anniversary Photographic Exhibition",
    description: siteConfig.description,
    url: siteConfig.url,
    startDate: siteConfig.exhibition.opens,
    endDate: siteConfig.exhibition.closes,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: {
      "@type": "Place",
      name: "The Georgette 150th gallery",
      address: {
        "@type": "PostalAddress",
        streetAddress: "20 Morris Rd",
        addressLocality: "Forest Grove",
        addressRegion: "WA",
        postalCode: "6286",
        addressCountry: "AU",
      },
    },
    organizer: {
      "@type": "Person",
      name: siteConfig.artist,
      url: `${siteConfig.url}/about-the-photographer`,
    },
    performer: {
      "@type": "Person",
      name: siteConfig.artist,
      url: `${siteConfig.url}/about-the-photographer`,
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "AUD",
      availability: "https://schema.org/InStock",
      validFrom: `${siteConfig.exhibition.opens}T00:00:00+08:00`,
      url: `${siteConfig.url}/visit`,
      description: "Free admission to the exhibition",
    },
    image: [buildOgImageObject(), buildLogoImage()],
    inLanguage: "en-AU",
    isAccessibleForFree: true,
  };
}

export function buildPhotographerPerson(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: siteConfig.artist,
    url: `${siteConfig.url}/about-the-photographer`,
    image: `${siteConfig.url}/images/john-bowskill-portrait.jpg`,
    ...(socialProfiles.length ? { sameAs: socialProfiles } : {}),
    jobTitle: "Photographer",
    description:
      "Photographer behind The Georgette 150th Photographic Exhibition. Coastal photography around Redgate Beach, immersive installations, and the many stories of the SS Georgette.",
    knowsAbout: [
      "SS Georgette",
      "Redgate Beach",
      "Calgardup Bay",
      "Isaac Rock",
      "fine art photography",
      "Margaret River",
    ],
    workLocation: {
      "@type": "Place",
      name: "Margaret River region, Western Australia",
    },
  };
}

export function buildAboutPage(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About the Photographer",
    description:
      "About photographer John Bowskill and The Georgette 150th anniversary photographic exhibition.",
    url: `${siteConfig.url}/about-the-photographer`,
    mainEntity: {
      "@type": "Person",
      name: siteConfig.artist,
      url: `${siteConfig.url}/about-the-photographer`,
    },
    isPartOf: {
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    inLanguage: "en-AU",
  };
}

export const HOME_FAQ_ITEMS = [
  {
    question: "Where is the exhibition?",
    answer:
      "20 Morris Rd, Forest Grove WA 6286, in the Margaret River region of Western Australia.",
  },
  {
    question: "When is it open?",
    answer:
      "Daily from 10am to 5pm, 12–27 September 2026, during Margaret River Region Open Studios 2026.",
  },
  {
    question: "Is admission free?",
    answer: "Yes. Admission to The Georgette 150th is free.",
  },
  {
    question: "What is the SS Georgette?",
    answer:
      "The SS Georgette was a steamship that foundered off Redgate Beach on 1 December 1876. This exhibition marks 150 years since that wreck through photography made at the related coastal sites.",
  },
] as const;

export function buildHomeFaq(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function buildProduct(product: ProductWithVariantsAndImages): Record<string, unknown> {
  const primaryImage =
    product.product_images.find((image) => image.is_primary)?.image_url ||
    product.product_images[0]?.image_url ||
    "";
  const imageUrl = primaryImage
    ? primaryImage.startsWith("http")
      ? primaryImage
      : `${siteConfig.url}${primaryImage}`
    : `${siteConfig.url}${siteConfig.ogImage.shop}`;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description || "",
    url: `${siteConfig.url}/shop/${product.slug}`,
    image: imageUrl,
    sku: product.slug,
    category: "Fine art photographic print",
    brand: buildArtistPerson(),
    offers: product.product_variants
      .filter((variant) => variant.is_active)
      .map((variant) => ({
        "@type": "Offer",
        name: describeVariantForBuyer(variant) ?? variant.variant_label,
        price: (variant.price_aud / 100).toFixed(2),
        priceCurrency: "AUD",
        availability: "https://schema.org/InStock",
        itemCondition: "https://schema.org/NewCondition",
        url: `${siteConfig.url}/shop/${product.slug}`,
        seller: buildArtistPerson(),
      })),
  };
}

/**
 * The photograph as a creative work, distinct from the Product offer wrapped
 * around it. Gives the print pages a subject and a place rather than only a price.
 */
export function buildPhotographWork(
  product: ProductWithVariantsAndImages,
  caption: string | null,
  placeName: string | null,
): Record<string, unknown> {
  const primaryImage =
    product.product_images.find((image) => image.is_primary)?.image_url ||
    product.product_images[0]?.image_url ||
    "";

  return {
    "@context": "https://schema.org",
    "@type": "Photograph",
    name: product.title,
    ...(caption ? { caption, description: caption } : {}),
    url: `${siteConfig.url}/shop/${product.slug}`,
    ...(primaryImage ? { image: absoluteUrl(primaryImage) } : {}),
    creator: buildArtistPerson(),
    copyrightHolder: buildArtistPerson(),
    inLanguage: "en-AU",
    about: buildShipEntity(),
    ...(placeName
      ? {
          contentLocation: {
            "@type": "Place",
            name: placeName,
            address: {
              "@type": "PostalAddress",
              addressRegion: "WA",
              addressCountry: "AU",
            },
          },
        }
      : {}),
    ...(product.audio_url
      ? {
          associatedMedia: {
            "@type": "AudioObject",
            name: `Hear the story: ${product.title}`,
            contentUrl: absoluteUrl(product.audio_url),
            encodingFormat: "audio/mpeg",
            ...(product.audio_transcript ? { description: product.audio_transcript } : {}),
          },
        }
      : {}),
    isPartOf: {
      "@type": "ExhibitionEvent",
      name: siteConfig.name,
      url: siteConfig.url,
    },
  };
}

export function buildPrintsItemList(
  prints: Array<{ slug: string; title: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Limited edition prints — The Georgette 150th",
    numberOfItems: prints.length,
    itemListOrder: "https://schema.org/ItemListUnordered",
    itemListElement: prints.map((print, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: print.title,
      url: `${siteConfig.url}/shop/${print.slug}`,
    })),
  };
}

/** Long-form editorial pages (/story, /book) — signals reading material, not a listing. */
export function buildArticle({
  headline,
  description,
  path,
  image,
  section,
  datePublished,
  dateModified,
}: {
  headline: string;
  description: string;
  path: string;
  image?: string;
  section: string;
  datePublished?: string;
  dateModified?: string;
}): Record<string, unknown> {
  const url = `${siteConfig.url}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    author: buildArtistPerson(),
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
      logo: buildLogoImage(),
    },
    image: image ? absoluteUrl(image) : defaultImageUrl,
    articleSection: section,
    about: buildShipEntity(),
    inLanguage: "en-AU",
    isAccessibleForFree: true,
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
      item: `${siteConfig.url}${item.path === "/" ? "" : item.path}`,
    })),
  };
}
