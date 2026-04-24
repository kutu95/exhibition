import type { MediaFile } from "../supabase/types";

export function isManagedLocalMediaPath(src: string): boolean {
  return src.startsWith("/images/") || src.startsWith("/video/");
}

type ImageMedia = Pick<MediaFile, "alt_text" | "url_path">;

export type SiteContentImageRow = {
  content_value: string | null;
  media_files: ImageMedia | ImageMedia[] | null;
};

/**
 * Resolves image src/alt for a site_content row of type image, matching story/holding behaviour.
 * Prefers content_value (URL path) then linked media url_path.
 */
export function resolveContentImage(
  row: SiteContentImageRow | undefined,
  fallback: { src: string; alt: string },
): { src: string; alt: string } {
  if (!row) {
    return fallback;
  }
  const media = Array.isArray(row.media_files) ? row.media_files[0] : row.media_files;
  const src = row.content_value?.trim() || media?.url_path?.trim() || fallback.src;
  const alt = media?.alt_text?.trim() || fallback.alt;
  return { src, alt };
}
