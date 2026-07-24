import type { Metadata } from "next";

export const siteConfig = {
  name: "The Georgette 150th",
  artist: "John Bowskill",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://exhibition.margies.app",
  description:
    "John Bowskill’s photographic exhibition for the 150th anniversary of the SS Georgette shipwreck at Redgate Beach, Margaret River, Western Australia.",
  shortDescription:
    "The Georgette 150th photographic exhibition by John Bowskill · Margaret River Region Open Studios · 12–27 September 2026",
  exhibition: {
    opens: "2026-09-12",
    closes: "2026-09-27",
    location: "20 Morris Rd, Forest Grove WA 6286",
    event: "Margaret River Region Open Studios 2026",
  },
  social: {
    twitterHandle: null as string | null,
    facebook: "https://www.facebook.com/john.bowskill.12",
    instagram: "https://www.instagram.com/john_bowskill/",
  },
  ogImage: {
    default: "/og/default.jpg",
    story: "/og/story.jpg",
    installations: "/og/installations.jpg",
    shop: "/og/shop.jpg",
    visit: "/og/visit.jpg",
    about: "/og/default.jpg",
  },
};

export function buildMetadata({
  title,
  absoluteTitle,
  description,
  path = "",
  ogImage,
  noIndex = false,
  ogType = "website",
}: {
  title?: string;
  /** When set, used as the full document title without appending the site name. */
  absoluteTitle?: string;
  description?: string;
  path?: string;
  ogImage?: string;
  noIndex?: boolean;
  ogType?: "website" | "article" | "profile";
}): Metadata {
  const normalizedPath = path === "/" ? "" : path;
  const url = `${siteConfig.url}${normalizedPath}`;
  const rawImage = ogImage || siteConfig.ogImage.default;
  const image = rawImage.startsWith("http") ? rawImage : `${siteConfig.url}${rawImage}`;
  const resolvedTitle =
    absoluteTitle ?? (title ? `${title} | ${siteConfig.name}` : siteConfig.name);
  const resolvedDescription = description || siteConfig.description;
  const imageAlt = `${resolvedTitle} — photographic exhibition by ${siteConfig.artist}`;

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      url,
      siteName: siteConfig.name,
      locale: "en_AU",
      type: ogType,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: imageAlt,
          type: "image/jpeg",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
      images: [image],
      ...(siteConfig.social.twitterHandle ? { creator: siteConfig.social.twitterHandle } : {}),
    },
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
  };
}
