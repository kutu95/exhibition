import path from "node:path";

const resolveAppRoot = (): string => {
  const envRoot = process.env.APP_ROOT?.trim();
  if (envRoot) {
    return path.isAbsolute(envRoot) ? envRoot : path.resolve(envRoot);
  }
  return process.cwd();
};

export const resolveCanonicalMediaPath = (relativePath: string): string => {
  const publicDir = path.join(/* turbopackIgnore: true */ resolveAppRoot(), "public");
  const normalized = relativePath.replace(/^\/+/, "");
  return path.join(publicDir, normalized);
};
