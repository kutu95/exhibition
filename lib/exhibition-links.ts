import { siteConfig } from "./metadata";

/** Wall label QR: phone camera opens the product page so the visitor can choose a size. */
export const buildWallProductUrl = (slug: string, variantId?: string): string => {
  const url = new URL(`/shop/${slug}`, siteConfig.url);
  if (variantId) url.searchParams.set("variant", variantId);
  return url.toString();
};
