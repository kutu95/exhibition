import fs from "node:fs";
import path from "node:path";

const resolveAppRoot = (): string => {
  const envRoot = process.env.APP_ROOT?.trim();
  if (envRoot) {
    return path.isAbsolute(envRoot) ? envRoot : path.resolve(envRoot);
  }

  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, "package.json")) && fs.existsSync(path.join(dir, "public"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return process.cwd();
};

const normalizeRelativeMediaPath = (relativePath: string): string =>
  relativePath.replace(/^\/+/, "");

/**
 * Shared web media directory (images, video, and audio) when local and
 * production share one Supabase but need the same files on disk.
 *
 * Examples:
 *   Mac:     WEB_MEDIA_DIR=/Volumes/AppData/Exhibition/web-media
 *   Server:  WEB_MEDIA_DIR=/mnt/nas/AppData/Exhibition/web-media
 *
 * Layout under that folder mirrors public/: images/…, video/…, and audio/…
 */
export const getWebMediaRoot = (): string | null => {
  const configured = process.env.WEB_MEDIA_DIR?.trim();
  if (!configured) return null;
  return path.isAbsolute(configured) ? configured : path.resolve(resolveAppRoot(), configured);
};

export const getLocalPublicMediaRoot = (): string => path.join(resolveAppRoot(), "public");

/** Where new uploads should be written. */
export const resolveCanonicalMediaPath = (relativePath: string): string => {
  const normalized = normalizeRelativeMediaPath(relativePath);
  const sharedRoot = getWebMediaRoot();
  if (sharedRoot) {
    return path.join(sharedRoot, normalized);
  }
  return path.join(getLocalPublicMediaRoot(), normalized);
};

/**
 * Where to read a media file from. Prefers shared storage, then falls back
 * to local public/ so older uploads keep working after enabling WEB_MEDIA_DIR.
 */
export const resolveReadableMediaPath = (relativePath: string): string => {
  const normalized = normalizeRelativeMediaPath(relativePath);
  const candidates = [
    getWebMediaRoot() ? path.join(getWebMediaRoot() as string, normalized) : null,
    path.join(getLocalPublicMediaRoot(), normalized),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0] ?? path.join(getLocalPublicMediaRoot(), normalized);
};
