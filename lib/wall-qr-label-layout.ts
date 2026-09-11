export const WALL_QR_SIZE_MM = 50;
export const WALL_QR_PAGE_WIDTH_MM = 210;
export const WALL_QR_PAGE_HEIGHT_MM = 297;
export const WALL_QR_COLUMNS = 3;
export const WALL_QR_ROWS = 4;
export const WALL_QR_LABELS_PER_PAGE = WALL_QR_COLUMNS * WALL_QR_ROWS;

export type WallQrLabelProduct = {
  title: string;
  slug: string;
  location_tag: string | null;
  credit_attribution?: string | null;
  visibility?: "public" | "vault" | null;
};

export const wallQrLocationLabel = (locationTag: string | null | undefined): string =>
  locationTag?.trim() || "Other";

export const sortWallQrProducts = <T extends WallQrLabelProduct>(products: T[]): T[] =>
  [...products]
    .filter((product) => product.slug.trim() && product.title.trim())
    .sort((left, right) => {
      const leftLocation = wallQrLocationLabel(left.location_tag);
      const rightLocation = wallQrLocationLabel(right.location_tag);
      if (leftLocation !== rightLocation) {
        return leftLocation.localeCompare(rightLocation, "en");
      }
      return left.title.localeCompare(right.title, "en");
    });

export const groupWallQrProductsByLocation = <T extends { location_tag: string | null }>(
  products: T[],
): { location: string; products: T[] }[] => {
  const groups: { location: string; products: T[] }[] = [];
  for (const product of products) {
    const location = wallQrLocationLabel(product.location_tag);
    const last = groups[groups.length - 1];
    if (last && last.location === location) {
      last.products.push(product);
    } else {
      groups.push({ location, products: [product] });
    }
  }
  return groups;
};

export const parseWallLabelSlugs = (value: string | string[] | null | undefined): string[] => {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const part of raw.split(/[,\s]+/)) {
    const slug = part.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }
  return slugs;
};

export const filterWallLabelProductsBySlugs = <T extends { slug: string }>(products: T[], slugs: string[]): T[] => {
  if (slugs.length === 0) return products;
  const allowed = new Set(slugs);
  return products.filter((product) => allowed.has(product.slug));
};

export const applyWallLabelProductFilters = <T extends { slug: string; visibility?: "public" | "vault" | null }>(
  products: T[],
  searchParams: URLSearchParams,
): T[] => {
  const includeVault = searchParams.get("vault") !== "0";
  const visible = includeVault ? products : products.filter((product) => product.visibility !== "vault");
  return filterWallLabelProductsBySlugs(visible, parseWallLabelSlugs(searchParams.get("slugs")));
};

export const wallLabelDownloadQuery = (options: {
  includeVault: boolean;
  slugs?: readonly string[];
  totalCount?: number;
}): string => {
  const params = new URLSearchParams();
  if (!options.includeVault) params.set("vault", "0");
  const slugs = options.slugs ?? [];
  const sendSlugs = slugs.length > 0 && (options.totalCount === undefined || slugs.length < options.totalCount);
  if (sendSlugs) params.set("slugs", slugs.join(","));
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const wallQrSheetPageCount = (productCount: number): number => {
  if (productCount <= 0) return 1;
  return 1 + Math.ceil(productCount / WALL_QR_LABELS_PER_PAGE);
};
