import fs from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { siteConfig } from "../metadata";
import { resolveCanonicalMediaPath, resolveReadableMediaPath } from "../media-storage";
import type { CampaignBlock } from "./blocks";

/** Display width in email is 600px; 1200 covers 2× retina without shipping masters. */
export const EMAIL_IMAGE_MAX_WIDTH = 1200;
export const EMAIL_IMAGE_JPEG_QUALITY = 75;
export const EMAIL_IMAGE_PREFIX = "email-w1200-";

const localImageFilenamePattern = /^[a-z0-9-]+\.[a-z0-9]+$/i;

/** Deduplicate concurrent derivative builds for the same master. */
const inFlightDerivatives = new Map<string, Promise<string>>();

const siteHost = (): string | null => {
  try {
    return new URL(siteConfig.url).host.toLowerCase();
  } catch {
    return null;
  }
};

/**
 * Returns the `/images/{filename}` basename for same-origin local media, or null
 * when the URL is external / not an images path / already an email derivative.
 */
export const localImagesFilename = (pathOrUrl: string): string | null => {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const host = siteHost();
      if (!host || url.host.toLowerCase() !== host) {
        return null;
      }
      pathname = url.pathname;
    } catch {
      return null;
    }
  }

  if (!pathname.startsWith("/images/")) {
    return null;
  }

  const filename = pathname.slice("/images/".length);
  if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return null;
  }
  if (!localImageFilenamePattern.test(filename)) {
    return null;
  }
  if (filename.startsWith(EMAIL_IMAGE_PREFIX)) {
    return null;
  }

  return filename;
};

export const emailDerivativeFilename = (sourceFilename: string): string => {
  const stem = path.parse(sourceFilename).name;
  return `${EMAIL_IMAGE_PREFIX}${stem}.jpg`;
};

const isUsableDerivative = async (derivativePath: string, sourcePath: string): Promise<boolean> => {
  try {
    const [derivativeStat, sourceStat] = await Promise.all([
      fs.stat(derivativePath),
      fs.stat(sourcePath),
    ]);
    return derivativeStat.isFile() && derivativeStat.mtimeMs >= sourceStat.mtimeMs && derivativeStat.size > 0;
  } catch {
    return false;
  }
};

const buildEmailDerivative = async (
  sourceFilename: string,
  originalUrl: string,
): Promise<string> => {
  const sourcePath = resolveReadableMediaPath(`images/${sourceFilename}`);
  const derivativeName = emailDerivativeFilename(sourceFilename);
  const derivativeRelative = `images/${derivativeName}`;
  const derivativePath = resolveCanonicalMediaPath(derivativeRelative);
  const derivativeUrl = `/images/${derivativeName}`;

  if (await isUsableDerivative(derivativePath, sourcePath)) {
    return derivativeUrl;
  }

  try {
    await fs.access(sourcePath);
  } catch {
    return originalUrl;
  }

  await fs.mkdir(path.dirname(derivativePath), { recursive: true });

  const tempPath = `${derivativePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await sharp(sourcePath)
      .rotate()
      .resize({
        width: EMAIL_IMAGE_MAX_WIDTH,
        height: EMAIL_IMAGE_MAX_WIDTH,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .jpeg({ quality: EMAIL_IMAGE_JPEG_QUALITY, mozjpeg: true })
      .toFile(tempPath);

    await fs.rename(tempPath, derivativePath);
    return derivativeUrl;
  } catch {
    await fs.unlink(tempPath).catch(() => undefined);
    // Another concurrent writer may have finished successfully.
    if (await isUsableDerivative(derivativePath, sourcePath)) {
      return derivativeUrl;
    }
    return originalUrl;
  }
};

/**
 * Ensure a cached email-sized JPEG exists for a local `/images/…` master.
 * Masters are never modified. External URLs are returned unchanged.
 */
export const resolveEmailImageUrl = async (pathOrUrl: string): Promise<string> => {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return trimmed;

  const sourceFilename = localImagesFilename(trimmed);
  if (!sourceFilename) {
    return trimmed;
  }

  const existing = inFlightDerivatives.get(sourceFilename);
  if (existing) {
    return existing;
  }

  const pending = buildEmailDerivative(sourceFilename, trimmed).finally(() => {
    inFlightDerivatives.delete(sourceFilename);
  });
  inFlightDerivatives.set(sourceFilename, pending);
  return pending;
};

export const prepareCampaignBlocksForEmail = async (
  blocks: CampaignBlock[],
): Promise<CampaignBlock[]> => {
  return Promise.all(
    blocks.map(async (block) => {
      if (block.type === "image") {
        return { ...block, url: await resolveEmailImageUrl(block.url) };
      }
      if (block.type === "product") {
        return { ...block, image_url: await resolveEmailImageUrl(block.image_url) };
      }
      return block;
    }),
  );
};
