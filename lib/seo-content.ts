import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";

import { buildMetadata, siteConfig } from "./metadata";
import { SEO_CONTENT_LABELS, SEO_CONTENT_KEYS, type SeoContentKey } from "./seo-content-shared";
import { createSupabaseServerClient } from "./supabase/server";

export type SeoPageId =
  | "home"
  | "story"
  | "about"
  | "book"
  | "visit"
  | "shop"
  | "installations"
  | "cubarama"
  | "captain-godfrey"
  | "drift";

type SeoPageConfig = {
  titleKey: SeoContentKey;
  descriptionKey: SeoContentKey;
  path: string;
  ogImage: string;
  ogType?: "website" | "article" | "profile";
};

export { SEO_CONTENT_KEYS, SEO_CONTENT_LABELS };

/** Seed defaults — used only when DB keys are missing/blank so pages never 500 for crawlers. */
export const SEO_FALLBACKS: Record<SeoContentKey, string> = {
  seo_home_title: "The Georgette 150th Anniversary Photographic Exhibition | John Bowskill",
  seo_home_description:
    "John Bowskill’s photographic exhibition for the 150th anniversary of the SS Georgette shipwreck at Redgate Beach, Margaret River, Western Australia.",
  seo_story_title: "The Story | The Georgette 150th",
  seo_story_description:
    "On 1 December 1876 the SS Georgette foundered off Western Australia. Seven drowned when the lifeboat capsized. This is the story the history books got wrong.",
  seo_about_title: "About Photographer John Bowskill | The Georgette 150th",
  seo_about_description:
    "Meet photographer John Bowskill — The Georgette 150th exhibition, coastal photography near Redgate Beach, and immersive installations in Margaret River.",
  seo_book_title: "Author’s Preface — Book Sampler | The Georgette 150th",
  seo_book_description:
    "Read John Bowskill’s author’s preface — from a drone revelation at Calgardup Bay to Scotland, the Clyde, and who gets remembered.",
  seo_visit_title: "Visit | The Georgette 150th",
  seo_visit_description:
    "The Georgette 150th at 20 Morris Rd, Forest Grove WA 6286 — open daily 10am–5pm, 12–27 September 2026. Margaret River Region Open Studios. Free admission.",
  seo_shop_title: "Shop — Limited Edition Prints | The Georgette 150th",
  seo_shop_description:
    "Limited edition archival photographic prints by John Bowskill. Calgardup Bay, Redgate Beach, Isaac Rock, and the wreck site of the SS Georgette.",
  seo_installations_title: "Installations | The Georgette 150th",
  seo_installations_description:
    "Three immersive installations — Cubarama, Captain Godfrey AI, and Drift — at The Georgette 150th exhibition, Margaret River Region Open Studios 2026.",
  seo_cubarama_title: "Cubarama — Immersive Installation | The Georgette 150th",
  seo_cubarama_description:
    "Cubarama: a four-wall 360° video installation of Georgette coastal footage. Available for galleries and museums to license, buy, or borrow.",
  seo_captain_godfrey_title: "Captain Godfrey — Interactive Installation | The Georgette 150th",
  seo_captain_godfrey_description:
    "Captain Godfrey: interactive MetaHuman visitors speak with, drawn from inquiry records. Available for galleries and museums to license, buy, or borrow.",
  seo_drift_title: "Drift — Interactive Installation | The Georgette 150th",
  seo_drift_description:
    "Drift is a Kinect-driven installation where visitors’ movement chooses which photographs appear. Available for galleries and museums to license, buy, or borrow.",
};

export const SEO_PAGE_CONFIG: Record<SeoPageId, SeoPageConfig> = {
  home: {
    titleKey: "seo_home_title",
    descriptionKey: "seo_home_description",
    path: "/",
    ogImage: siteConfig.ogImage.default,
  },
  story: {
    titleKey: "seo_story_title",
    descriptionKey: "seo_story_description",
    path: "/story",
    ogImage: siteConfig.ogImage.story,
  },
  about: {
    titleKey: "seo_about_title",
    descriptionKey: "seo_about_description",
    path: "/about-the-photographer",
    ogImage: siteConfig.ogImage.about,
  },
  book: {
    titleKey: "seo_book_title",
    descriptionKey: "seo_book_description",
    path: "/book",
    ogImage: siteConfig.ogImage.story,
    ogType: "article",
  },
  visit: {
    titleKey: "seo_visit_title",
    descriptionKey: "seo_visit_description",
    path: "/visit",
    ogImage: siteConfig.ogImage.visit,
  },
  shop: {
    titleKey: "seo_shop_title",
    descriptionKey: "seo_shop_description",
    path: "/shop",
    ogImage: siteConfig.ogImage.shop,
  },
  installations: {
    titleKey: "seo_installations_title",
    descriptionKey: "seo_installations_description",
    path: "/installations",
    ogImage: siteConfig.ogImage.installations,
  },
  cubarama: {
    titleKey: "seo_cubarama_title",
    descriptionKey: "seo_cubarama_description",
    path: "/installations/cubarama",
    ogImage: siteConfig.ogImage.installations,
  },
  "captain-godfrey": {
    titleKey: "seo_captain_godfrey_title",
    descriptionKey: "seo_captain_godfrey_description",
    path: "/installations/captain-godfrey",
    ogImage: siteConfig.ogImage.installations,
  },
  drift: {
    titleKey: "seo_drift_title",
    descriptionKey: "seo_drift_description",
    path: "/installations/drift",
    ogImage: siteConfig.ogImage.installations,
  },
};

export type SeoContent = {
  absoluteTitle: string;
  description: string;
  path: string;
  ogImage: string;
  ogType?: "website" | "article" | "profile";
};

function resolveSeoValue(contentKey: SeoContentKey, value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (trimmed) return trimmed;
  console.warn(
    `[seo] Missing or blank "${contentKey}" in site_content — using fallback. Fix in Admin → Content → SEO.`,
  );
  return SEO_FALLBACKS[contentKey];
}

/**
 * Upper bound on how long metadata may wait for Supabase.
 *
 * Metadata that resolves after React has flushed the document shell is emitted
 * *after* `</head>` — React hoists it client-side, but the initial HTML a crawler
 * parses then has no title, description or canonical. Capping the wait keeps
 * metadata off the critical path even when the database is slow.
 */
const SEO_QUERY_TIMEOUT_MS = 1200;

function staticSeo(pageId: SeoPageId): SeoContent {
  const config = SEO_PAGE_CONFIG[pageId];
  return {
    absoluteTitle: SEO_FALLBACKS[config.titleKey],
    description: SEO_FALLBACKS[config.descriptionKey],
    path: config.path,
    ogImage: config.ogImage,
    ogType: config.ogType,
  };
}

async function loadSeoForPage(pageId: SeoPageId): Promise<SeoContent> {
  const config = SEO_PAGE_CONFIG[pageId];

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("site_content")
      .select("content_key, content_value")
      .in("content_key", [config.titleKey, config.descriptionKey]);

    if (error) {
      console.warn(`[seo] Failed to load SEO for "${pageId}": ${error.message}`);
      return staticSeo(pageId);
    }

    const byKey = new Map((data ?? []).map((row) => [row.content_key, row.content_value]));

    return {
      absoluteTitle: resolveSeoValue(config.titleKey, byKey.get(config.titleKey)),
      description: resolveSeoValue(config.descriptionKey, byKey.get(config.descriptionKey)),
      path: config.path,
      ogImage: config.ogImage,
      ogType: config.ogType,
    };
  } catch (err) {
    // Reading cookies during a static-render probe throws by design: it is how Next
    // marks the route dynamic. Swallowing it would hide real Supabase failures.
    unstable_rethrow(err);
    console.warn(`[seo] Unexpected error loading SEO for "${pageId}":`, err);
    return staticSeo(pageId);
  }
}

/**
 * Deduplicated per request: `generateMetadata` and the page body can both await
 * this and share a single Supabase round-trip. Pages should await it so React
 * cannot flush the shell before the metadata is ready.
 */
export const getSeoForPage = cache(async (pageId: SeoPageId): Promise<SeoContent> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<SeoContent>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[seo] Timed out loading SEO for "${pageId}" — using fallback.`);
      resolve(staticSeo(pageId));
    }, SEO_QUERY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([loadSeoForPage(pageId), timeout]);
  } finally {
    clearTimeout(timer);
  }
});

/**
 * Await at the top of a page whose body does no other async work. Without it
 * React flushes the shell immediately and the still-pending metadata lands after
 * `</head>`, leaving crawlers an initial response with no title or canonical.
 */
export async function awaitPageMetadata(pageId: SeoPageId): Promise<void> {
  await getSeoForPage(pageId);
}

export async function buildPageMetadata(pageId: SeoPageId): Promise<Metadata> {
  const seo = await getSeoForPage(pageId);
  return buildMetadata({
    absoluteTitle: seo.absoluteTitle,
    description: seo.description,
    path: seo.path,
    ogImage: seo.ogImage,
    ogType: seo.ogType,
  });
}
