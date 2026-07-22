import type { MediaFile } from "../supabase/types";

export function isManagedLocalMediaPath(src: string): boolean {
  return src.startsWith("/images/") || src.startsWith("/video/");
}

/** Absolute http(s) URLs or managed local media paths used by product images. */
export function isValidProductImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isManagedLocalMediaPath(trimmed)) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

type ImageMedia = Pick<MediaFile, "alt_text" | "url_path">;

export type SiteContentImageRow = {
  content_value: string | null;
  media_files?: ImageMedia | ImageMedia[] | null;
};

const CONTENT_IMAGE_ALT_FALLBACKS: Record<string, string> = {
  installation_cubarama_image: "Cubarama 360° immersive video installation at The Georgette 150th",
  installation_captain_godfrey_image:
    "Captain Godfrey interactive AI MetaHuman installation at The Georgette 150th",
  installation_drift_image: "Drift interactive installation at The Georgette 150th",
  author_talk_image: "Marcia van Zeller",
};

export function resolveOptionalContentImage(
  row: SiteContentImageRow | undefined,
  key?: string,
): { src: string; alt: string } | null {
  const media = Array.isArray(row?.media_files) ? row.media_files[0] : row?.media_files;
  const src = row?.content_value?.trim() || media?.url_path?.trim();
  if (!src) return null;
  const alt =
    media?.alt_text?.trim() ||
    (key ? CONTENT_IMAGE_ALT_FALLBACKS[key] : "") ||
    "";
  return { src, alt };
}

/**
 * Resolves a required site_content image. Missing values are configuration errors.
 */
export function resolveContentImage(
  row: SiteContentImageRow | undefined,
  key: string,
): { src: string; alt: string } {
  const media = Array.isArray(row?.media_files) ? row.media_files[0] : row?.media_files;
  const src = row?.content_value?.trim() || media?.url_path?.trim();

  if (!src) {
    throw new Error(
      `Missing required site content image: ${key}. Set it in Admin → Content → Installations (or the matching content group).`,
    );
  }

  const alt =
    media?.alt_text?.trim() || CONTENT_IMAGE_ALT_FALLBACKS[key] || key.replace(/_/g, " ");
  return { src, alt };
}
