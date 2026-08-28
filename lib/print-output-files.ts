import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type LocalPrintFileRef = {
  order_number: string;
  slug: string;
  width_mm: number;
  height_mm: number;
  cloud_file_url?: string | null;
  cloud_folder_path?: string | null;
};

export type LocalPrintFile = {
  path: string;
  name: string;
};

export const getLocalOutputDir = (): string => {
  const raw = process.env.LOCAL_OUTPUT_DIR?.trim();
  if (!raw) {
    throw new Error("LOCAL_OUTPUT_DIR is not configured on the app server.");
  }
  return path.resolve(raw);
};

const getLocalOutputRoot = async (): Promise<string> => {
  const rootResolved = getLocalOutputDir();
  await fs.mkdir(rootResolved, { recursive: true });
  return fs.realpath(rootResolved);
};

const assertInsideLocalOutput = async (candidatePath: string, root?: string): Promise<string> => {
  const outputRoot = root ?? (await getLocalOutputRoot());
  const resolved = await fs.realpath(path.resolve(candidatePath));
  const relative = path.relative(outputRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Print file path is outside LOCAL_OUTPUT_DIR.");
  }
  return resolved;
};

/** Resolve a stored `file://…` cloud_file_url to an absolute path under LOCAL_OUTPUT_DIR. */
export const resolveLocalPrintFilePath = async (cloudFileUrl: string): Promise<string> => {
  const trimmed = cloudFileUrl.trim();
  if (!trimmed.startsWith("file:")) {
    throw new Error("Not a local print file URL.");
  }

  let decoded: string;
  try {
    decoded = fileURLToPath(trimmed);
  } catch {
    throw new Error("Invalid local print file URL.");
  }

  return assertInsideLocalOutput(decoded);
};

const looksLikeFilesystemPath = (value: string): boolean =>
  value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value) || value.includes("print-output");

const expectedPrintFileName = (item: LocalPrintFileRef): string => {
  // Match worker: f"{order}_{slug}_{int(width)}x{int(height)}mm.tif"
  const width = Math.trunc(Number(item.width_mm) || 0);
  const height = Math.trunc(Number(item.height_mm) || 0);
  return `${item.order_number}_${item.slug}_${width}x${height}mm.tif`;
};

// One folder per photograph in an order, holding every size ordered of it.
const expectedPrintFolderName = (item: LocalPrintFileRef): string =>
  `${item.order_number}_${item.slug}`;

const legacyPrintFolderName = (item: LocalPrintFileRef): string => item.order_number;

const tryFile = async (candidate: string, root: string): Promise<LocalPrintFile | null> => {
  try {
    const resolved = await assertInsideLocalOutput(candidate, root);
    const stat = await fs.stat(resolved);
    if (!stat.isFile()) return null;
    return { path: resolved, name: path.basename(resolved) };
  } catch {
    return null;
  }
};

/**
 * Locate the prepared lab TIFF under LOCAL_OUTPUT_DIR (print-output), not the master.
 * Tries file:// URL, expected worker path, local folder path, then any .tif in the photograph folder.
 */
export const findLocalPrintFile = async (item: LocalPrintFileRef): Promise<LocalPrintFile | null> => {
  const cloudUrl = item.cloud_file_url?.trim() ?? "";
  if (cloudUrl.startsWith("file:")) {
    try {
      const filePath = await resolveLocalPrintFilePath(cloudUrl);
      return { path: filePath, name: path.basename(filePath) };
    } catch {
      // Fall through to path reconstruction.
    }
  }

  let root: string;
  try {
    root = await getLocalOutputRoot();
  } catch {
    return null;
  }

  const folderName = expectedPrintFolderName(item);
  const legacyFolderName = legacyPrintFolderName(item);
  const fileName = expectedPrintFileName(item);
  const candidates: string[] = [
    path.join(root, folderName, fileName),
    path.join(root, legacyFolderName, fileName),
  ];

  const folderPath = item.cloud_folder_path?.trim() ?? "";
  if (folderPath && looksLikeFilesystemPath(folderPath)) {
    candidates.push(path.join(folderPath, fileName));
  }

  for (const candidate of candidates) {
    const found = await tryFile(candidate, root);
    if (found) return found;
  }

  // Scan the photograph folder, then the older per-order folder, for a matching TIFF.
  for (const scanFolder of [folderName, legacyFolderName]) {
    try {
      const folder = await assertInsideLocalOutput(path.join(root, scanFolder), root);
      const entries = await fs.readdir(folder);
      const tiffs = entries.filter((entry) => /\.tiff?$/i.test(entry)).sort();
      const slugMatch = tiffs.filter((entry) => entry.includes(item.slug));
      const picked =
        tiffs.find((entry) => entry === fileName) ??
        (slugMatch.length === 1 ? slugMatch[0] : undefined) ??
        (tiffs.length === 1 ? tiffs[0] : undefined);
      if (picked) return tryFile(path.join(folder, picked), root);
    } catch {
      // No local folder yet.
    }
  }

  return null;
};
