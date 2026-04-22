import fs from "node:fs/promises";
import path from "node:path";

const PUBLIC_DIR_NAME = "public";

const dirExists = async (targetPath: string): Promise<boolean> => {
  try {
    const stats = await fs.stat(targetPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

/**
 * Returns the public directory that is actually served by the running app.
 * In production standalone builds, static files are served from `.next/standalone/public`.
 * In local/dev contexts, static files are served from `public`.
 */
export const resolveServedPublicDir = async (): Promise<string> => {
  const cwd = process.cwd();
  const standalonePublicDir = path.join(/* turbopackIgnore: true */ cwd, ".next", "standalone", PUBLIC_DIR_NAME);
  if (await dirExists(standalonePublicDir)) {
    return standalonePublicDir;
  }

  return path.join(/* turbopackIgnore: true */ cwd, PUBLIC_DIR_NAME);
};

export const resolveServedMediaPath = async (relativePath: string): Promise<string> => {
  const publicDir = await resolveServedPublicDir();
  const normalized = relativePath.replace(/^\/+/, "");
  return path.join(publicDir, normalized);
};
