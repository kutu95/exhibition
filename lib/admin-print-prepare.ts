import { execFile } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { getMasterFilesDir, resolveMasterFilePath, safeMasterFilename } from "./master-files";
import { getLocalOutputDir } from "./print-output-files";

const execFileAsync = promisify(execFile);

const resolveAppRoot = (): string => {
  const envRoot = process.env.APP_ROOT?.trim();
  if (envRoot) {
    return path.isAbsolute(envRoot) ? envRoot : path.resolve(envRoot);
  }
  return process.cwd();
};

export type AdminPrintPrepareInput = {
  slug: string;
  masterFilename: string;
  widthMm: number;
  heightMm: number;
  borderMm?: number | null;
  printDpi?: number | null;
  fitMode?: "custom_size" | "cover_crop" | null;
  cropOffset?: number | null;
};

export type AdminPrintFile = {
  path: string;
  name: string;
  relativePath: string;
};

const formatExecError = (error: unknown): string => {
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : "Unknown print generation error.";
  }
  const record = error as {
    message?: string;
    code?: string | number;
    signal?: string;
    stderr?: string | Buffer;
    stdout?: string | Buffer;
  };
  const parts: string[] = [];
  if (record.message) parts.push(record.message);
  if (record.code !== undefined) parts.push(`code=${String(record.code)}`);
  if (record.signal) parts.push(`signal=${record.signal}`);
  const stderr = typeof record.stderr === "string" ? record.stderr : record.stderr?.toString("utf8");
  const stdout = typeof record.stdout === "string" ? record.stdout : record.stdout?.toString("utf8");
  const detail = (stderr || stdout || "").trim();
  if (detail) parts.push(detail.slice(0, 2000));
  return parts.filter(Boolean).join(" | ") || "Unknown print generation error.";
};

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "print";

export const adminPrintFileName = (slug: string, widthMm: number, heightMm: number): string => {
  const safeSlug = slugify(slug);
  return `admin_${safeSlug}_${Math.trunc(widthMm)}x${Math.trunc(heightMm)}mm.tif`;
};

export const adminPrintRelativeDir = (slug: string): string => path.join("_admin", slugify(slug));

export const resolveAdminPrintFilePath = (slug: string, widthMm: number, heightMm: number): string =>
  path.join(getLocalOutputDir(), adminPrintRelativeDir(slug), adminPrintFileName(slug, widthMm, heightMm));

export const findAdminPrintFile = async (
  slug: string,
  widthMm: number,
  heightMm: number,
): Promise<AdminPrintFile | null> => {
  const filePath = resolveAdminPrintFilePath(slug, widthMm, heightMm);
  try {
    const stat = await fsPromises.stat(filePath);
    if (!stat.isFile() || stat.size === 0) return null;
    return {
      path: filePath,
      name: path.basename(filePath),
      relativePath: path.join(adminPrintRelativeDir(slug), path.basename(filePath)),
    };
  } catch {
    return null;
  }
};

export const prepareAdminPrintFile = async (input: AdminPrintPrepareInput): Promise<AdminPrintFile> => {
  const appRoot = resolveAppRoot();
  const venvPython = path.join(appRoot, ".worker-venv", "bin", "python3");
  const scriptPath = path.join(appRoot, "worker", "generate_print_file.py");
  const profilePath = process.env.PRINT_OUTPUT_PROFILE_PATH?.trim();

  if (!profilePath) {
    throw new Error("PRINT_OUTPUT_PROFILE_PATH is not configured.");
  }
  if (!fs.existsSync(venvPython)) {
    throw new Error(`Worker Python is missing at ${venvPython}.`);
  }
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Print script is missing at ${scriptPath}.`);
  }

  // Touch master dir config early for clearer errors.
  getMasterFilesDir();
  const masterPath = resolveMasterFilePath(safeMasterFilename(input.masterFilename));
  if (!fs.existsSync(masterPath)) {
    throw new Error(`Master TIFF was not found: ${input.masterFilename}`);
  }

  const widthMm = input.widthMm;
  const heightMm = input.heightMm;
  if (!(widthMm > 0) || !(heightMm > 0)) {
    throw new Error("Variant width_mm and height_mm must be positive.");
  }

  const outputPath = resolveAdminPrintFilePath(input.slug, widthMm, heightMm);
  await fsPromises.mkdir(path.dirname(outputPath), { recursive: true });

  const args = [
    scriptPath,
    "--master",
    masterPath,
    "--output",
    outputPath,
    "--slug",
    input.slug,
    "--width-mm",
    String(widthMm),
    "--height-mm",
    String(heightMm),
    "--border-mm",
    String(input.borderMm ?? 0),
    "--print-dpi",
    String(input.printDpi && input.printDpi > 0 ? input.printDpi : 300),
    "--fit-mode",
    input.fitMode === "cover_crop" ? "cover_crop" : "custom_size",
    "--crop-offset",
    String(input.cropOffset ?? 0),
    "--output-profile",
    profilePath,
  ];

  try {
    await execFileAsync(venvPython, args, {
      cwd: appRoot,
      timeout: 10 * 60_000,
      maxBuffer: 2 * 1024 * 1024,
      env: {
        ...process.env,
        // Ensure imports resolve when the script loads fulfilment_worker.
        PYTHONPATH: [path.join(appRoot, "worker"), process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
      },
    });
  } catch (error) {
    throw new Error(`Failed to prepare print TIFF. ${formatExecError(error)}`);
  }

  const found = await findAdminPrintFile(input.slug, widthMm, heightMm);
  if (!found) {
    throw new Error("Print TIFF was generated but could not be found on disk.");
  }
  return found;
};
