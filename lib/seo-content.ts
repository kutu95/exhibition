import type { Metadata } from "next";

import { buildMetadata, siteConfig } from "./metadata";
import { SEO_CONTENT_LABELS, SEO_CONTENT_KEYS } from "./seo-content-shared";
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
  titleKey: string;
  descriptionKey: string;
  path: string;
  ogImage: string;
  ogType?: "website" | "article" | "profile";
};

export { SEO_CONTENT_KEYS, SEO_CONTENT_LABELS };

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

function requireTrimmed(value: string | null | undefined, contentKey: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new Error(
      `Missing SEO content for "${contentKey}". Set it in Admin → Content → SEO / Link previews.`,
    );
  }
  return trimmed;
}

export async function getSeoForPage(pageId: SeoPageId): Promise<SeoContent> {
  const config = SEO_PAGE_CONFIG[pageId];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("site_content")
    .select("content_key, content_value")
    .in("content_key", [config.titleKey, config.descriptionKey]);

  if (error) {
    throw new Error(`Failed to load SEO content for "${pageId}": ${error.message}`);
  }

  const byKey = new Map((data ?? []).map((row) => [row.content_key, row.content_value]));

  return {
    absoluteTitle: requireTrimmed(byKey.get(config.titleKey), config.titleKey),
    description: requireTrimmed(byKey.get(config.descriptionKey), config.descriptionKey),
    path: config.path,
    ogImage: config.ogImage,
    ogType: config.ogType,
  };
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
