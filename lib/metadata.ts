import type { Metadata } from "next";

export const siteConfig = {
  name: "The Georgette 150th",
  artist: "John Bowskill",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://exhibition.margies.app",
  description:
    "A photography exhibition marking 150 years since the wreck of the SS Georgette. Calgardup Bay, Redgate Beach, Isaac Rock. Margaret River Region Open Studios, 12–27 September 2026.",
  shortDescription: "Photography exhibition · Margaret River Region Open Studios · 12–27 September 2026",
  exhibition: {
    opens: "2026-09-12",
    closes: "2026-09-27",
    location: "Margaret River Region, Western Australia",
    event: "Margaret River Region Open Studios 2026",
  },
  social: {
    twitterHandle: null as string | null,
  },
  ogImage: {
    default: "/og/default.jpg",
    story: "/og/story.jpg",
    installations: "/og/installations.jpg",
    shop: "/og/shop.jpg",
    visit: "/og/visit.jpg",
  },
};

export function buildMetadata({
  title,
  description,
  path = "",
  ogImage,
  noIndex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  ogImage?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${siteConfig.url}${path}`;
  const image = ogImage || siteConfig.ogImage.default;
  const resolvedTitle = title ? `${title} | ${siteConfig.name}` : siteConfig.name;
  const resolvedDescription = description || siteConfig.description;

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
      type: "website",
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: resolvedTitle,
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
          },
        },
  };
}
