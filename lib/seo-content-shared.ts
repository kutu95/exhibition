/** Shared SEO content-key constants (safe for client + server). */

export const SEO_CONTENT_KEYS = [
  "seo_home_title",
  "seo_home_description",
  "seo_story_title",
  "seo_story_description",
  "seo_about_title",
  "seo_about_description",
  "seo_book_title",
  "seo_book_description",
  "seo_visit_title",
  "seo_visit_description",
  "seo_shop_title",
  "seo_shop_description",
  "seo_installations_title",
  "seo_installations_description",
  "seo_cubarama_title",
  "seo_cubarama_description",
  "seo_captain_godfrey_title",
  "seo_captain_godfrey_description",
  "seo_drift_title",
  "seo_drift_description",
] as const;

export type SeoContentKey = (typeof SEO_CONTENT_KEYS)[number];

export const SEO_CONTENT_LABELS: Record<SeoContentKey, string> = {
  seo_home_title: "Home — title",
  seo_home_description: "Home — description",
  seo_story_title: "Story — title",
  seo_story_description: "Story — description",
  seo_about_title: "About the Photographer — title",
  seo_about_description: "About the Photographer — description",
  seo_book_title: "Book preface — title",
  seo_book_description: "Book preface — description",
  seo_visit_title: "Visit — title",
  seo_visit_description: "Visit — description",
  seo_shop_title: "Shop — title",
  seo_shop_description: "Shop — description",
  seo_installations_title: "Installations — title",
  seo_installations_description: "Installations — description",
  seo_cubarama_title: "Cubarama — title",
  seo_cubarama_description: "Cubarama — description",
  seo_captain_godfrey_title: "Captain Godfrey — title",
  seo_captain_godfrey_description: "Captain Godfrey — description",
  seo_drift_title: "Drift — title",
  seo_drift_description: "Drift — description",
};
