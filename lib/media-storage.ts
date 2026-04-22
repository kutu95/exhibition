import path from "node:path";

export const resolveCanonicalMediaPath = (relativePath: string): string => {
  const publicDir = path.join(/* turbopackIgnore: true */ process.cwd(), "public");
  const normalized = relativePath.replace(/^\/+/, "");
  return path.join(publicDir, normalized);
};
