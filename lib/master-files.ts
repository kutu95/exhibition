import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

import { queryPostgres } from "./postgres";

export type MasterFileCandidate = {
  filename: string;
  size_bytes: number;
  modified_at: string;
  pixel_width: number | null;
  pixel_height: number | null;
  aspect_ratio: string | null;
  suggested_title: string;
  suggested_slug: string;
};

type RegisteredMasterFileRow = {
  master_filename: string;
};

const tiffExtensions = new Set([".tif", ".tiff"]);
const TIFF_IMAGE_WIDTH_TAG = 256;
const TIFF_IMAGE_HEIGHT_TAG = 257;
const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;

/**
 * macOS writes AppleDouble metadata as `._original.tif` when copying onto SMB/NAS
 * (and similar non-HFS volumes). Those keep a .tif extension, so a naive scan
 * treats them as masters. They are not images and are safe to delete.
 */
export const isAppleDoubleSidecar = (filename: string): boolean =>
  path.basename(filename).startsWith("._");

export const isIgnorableMasterDirEntry = (filename: string): boolean => {
  const base = path.basename(filename);
  if (!base || base === "." || base === "..") return true;
  if (base === ".DS_Store" || base === "Thumbs.db") return true;
  if (base.startsWith("._") || base.startsWith(".")) return true;
  return false;
};

type TiffDimensions = {
  width: number;
  height: number;
};

export const getMasterFilesDir = (): string => {
  const isDev = process.env.NODE_ENV !== "production";
  const devValue = process.env.MASTER_FILES_DIR_DEV?.trim();
  const primaryValue = process.env.MASTER_FILES_DIR?.trim();

  const value = isDev ? (devValue || primaryValue) : primaryValue;
  if (!value) {
    throw new Error(
      isDev
        ? "Master files directory is not configured. Set MASTER_FILES_DIR_DEV (preferred for local development) or MASTER_FILES_DIR."
        : "Master files directory is not configured. Set MASTER_FILES_DIR.",
    );
  }

  return value;
};

export const safeMasterFilename = (filename: string): string => {
  const trimmed = filename.trim();
  if (!trimmed || path.basename(trimmed) !== trimmed) {
    throw new Error("Master filename must be a filename only, not a path.");
  }

  if (isIgnorableMasterDirEntry(trimmed) || isAppleDoubleSidecar(trimmed)) {
    throw new Error("That file is a system sidecar (for example a macOS ._ metadata file), not a master TIFF.");
  }

  const extension = path.extname(trimmed).toLowerCase();
  if (!tiffExtensions.has(extension)) {
    throw new Error("Master filename must end in .tif or .tiff.");
  }

  return trimmed;
};

export const resolveMasterFilePath = (filename: string): string =>
  path.join(getMasterFilesDir(), safeMasterFilename(filename));

export const getMasterFileDimensions = async (
  filename: string,
): Promise<{ pixel_width: number; pixel_height: number; aspect_ratio: string } | null> => {
  const dimensions = await readTiffDimensions(resolveMasterFilePath(filename)).catch(() => null);
  if (!dimensions) return null;
  return {
    pixel_width: dimensions.width,
    pixel_height: dimensions.height,
    aspect_ratio: formatAspectRatio(dimensions.width, dimensions.height),
  };
};

export const suggestTitleFromMasterFilename = (filename: string): string => {
  const stem = path.basename(filename, path.extname(filename));
  return stem
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const suggestSlugFromMasterFilename = (filename: string): string => {
  const stem = path.basename(filename, path.extname(filename));
  return stem
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const greatestCommonDivisor = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x || 1;
};

const formatAspectRatio = (width: number, height: number): string => {
  const gcd = greatestCommonDivisor(width, height);
  const reducedWidth = width / gcd;
  const reducedHeight = height / gcd;
  const decimal = width / height;

  if (reducedWidth <= 100 && reducedHeight <= 100) {
    return `${reducedWidth}:${reducedHeight} (${decimal.toFixed(2)}:1)`;
  }

  return `${decimal.toFixed(2)}:1`;
};

const readUInt16 = (buffer: Buffer, offset: number, littleEndian: boolean): number =>
  littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);

const readUInt32 = (buffer: Buffer, offset: number, littleEndian: boolean): number =>
  littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);

const readTiffEntryValue = (
  entry: Buffer,
  valueOffset: number,
  type: number,
  count: number,
  littleEndian: boolean,
): number | null => {
  if (count < 1) return null;

  if (type === TIFF_TYPE_SHORT) {
    return readUInt16(entry, valueOffset, littleEndian);
  }

  if (type === TIFF_TYPE_LONG) {
    return readUInt32(entry, valueOffset, littleEndian);
  }

  return null;
};

export const readTiffDimensions = async (filePath: string): Promise<TiffDimensions | null> => {
  const handle = await fs.open(filePath, "r");

  try {
    const header = Buffer.alloc(8);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < header.length) return null;

    const byteOrder = header.subarray(0, 2).toString("ascii");
    const littleEndian = byteOrder === "II";
    if (!littleEndian && byteOrder !== "MM") return null;

    const magic = readUInt16(header, 2, littleEndian);
    if (magic !== 42) return null;

    const ifdOffset = readUInt32(header, 4, littleEndian);
    if (ifdOffset <= 0) return null;

    const countBuffer = Buffer.alloc(2);
    const countRead = await handle.read(countBuffer, 0, countBuffer.length, ifdOffset);
    if (countRead.bytesRead < countBuffer.length) return null;

    const entryCount = readUInt16(countBuffer, 0, littleEndian);
    if (entryCount <= 0 || entryCount > 4096) return null;

    const entries = Buffer.alloc(entryCount * 12);
    const entriesRead = await handle.read(entries, 0, entries.length, ifdOffset + 2);
    if (entriesRead.bytesRead < entries.length) return null;

    let width: number | null = null;
    let height: number | null = null;

    for (let index = 0; index < entryCount; index += 1) {
      const offset = index * 12;
      const entry = entries.subarray(offset, offset + 12);
      const tag = readUInt16(entry, 0, littleEndian);
      if (tag !== TIFF_IMAGE_WIDTH_TAG && tag !== TIFF_IMAGE_HEIGHT_TAG) continue;

      const type = readUInt16(entry, 2, littleEndian);
      const count = readUInt32(entry, 4, littleEndian);
      const value = readTiffEntryValue(entry, 8, type, count, littleEndian);
      if (!value || value <= 0) continue;

      if (tag === TIFF_IMAGE_WIDTH_TAG) {
        width = value;
      } else {
        height = value;
      }
    }

    return width && height ? { width, height } : null;
  } finally {
    await handle.close();
  }
};

/**
 * Remove macOS AppleDouble `._*` junk from the masters folder.
 * Returns how many files were deleted (best-effort; failures are skipped).
 */
export const purgeAppleDoubleSidecars = async (dir?: string): Promise<number> => {
  const targetDir = dir ?? getMasterFilesDir();
  let entries: Dirent[];
  try {
    entries = await fs.readdir(targetDir, { withFileTypes: true });
  } catch {
    return 0;
  }

  let deleted = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !isAppleDoubleSidecar(entry.name)) continue;
    try {
      await fs.unlink(path.join(targetDir, entry.name));
      deleted += 1;
    } catch {
      // Leave it; listing will still ignore it.
    }
  }
  return deleted;
};

export const listUnregisteredMasterFiles = async (): Promise<MasterFileCandidate[]> => {
  const dir = getMasterFilesDir();
  await purgeAppleDoubleSidecars(dir);

  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Master files directory was not found: ${dir}. In local development, set MASTER_FILES_DIR_DEV to an existing folder with your TIFF masters.`,
      );
    }
    throw error;
  }
  const { rows } = await queryPostgres<RegisteredMasterFileRow>(`
    select distinct master_filename
    from exhibition.product_variants
    where master_filename is not null
  `);

  const registered = new Set(rows.map((row) => row.master_filename));
  const candidates: MasterFileCandidate[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (isIgnorableMasterDirEntry(entry.name)) continue;

    const extension = path.extname(entry.name).toLowerCase();
    if (!tiffExtensions.has(extension) || registered.has(entry.name)) continue;

    const filePath = path.join(dir, entry.name);
    const stat = await fs.stat(filePath);
    const dimensions = await readTiffDimensions(filePath).catch(() => null);
    candidates.push({
      filename: entry.name,
      size_bytes: stat.size,
      modified_at: stat.mtime.toISOString(),
      pixel_width: dimensions?.width ?? null,
      pixel_height: dimensions?.height ?? null,
      aspect_ratio: dimensions ? formatAspectRatio(dimensions.width, dimensions.height) : null,
      suggested_title: suggestTitleFromMasterFilename(entry.name),
      suggested_slug: suggestSlugFromMasterFilename(entry.name),
    });
  }

  return candidates.sort((a, b) => b.modified_at.localeCompare(a.modified_at));
};
