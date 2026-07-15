import path from "node:path";

const resolveAppRoot = (): string => {
  const envRoot = process.env.APP_ROOT?.trim();
  if (envRoot) {
    return path.isAbsolute(envRoot) ? envRoot : path.resolve(envRoot);
  }
  return process.cwd();
};

export const resolvePrivateStoragePath = (relativePath: string): string => {
  const normalized = relativePath.replace(/^\/+/, "");
  return path.join(/* turbopackIgnore: true */ resolveAppRoot(), "storage", normalized);
};
