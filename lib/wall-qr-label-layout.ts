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
  visibility?: "public" | "vault" | null;
};

export const sortWallQrProducts = (products: WallQrLabelProduct[]): WallQrLabelProduct[] =>
  [...products]
    .filter((product) => product.slug.trim() && product.title.trim())
    .sort((left, right) => {
      const leftLocation = left.location_tag?.trim() || "Other";
      const rightLocation = right.location_tag?.trim() || "Other";
      if (leftLocation !== rightLocation) {
        return leftLocation.localeCompare(rightLocation, "en");
      }
      return left.title.localeCompare(right.title, "en");
    });

export const wallQrSheetPageCount = (productCount: number): number => {
  if (productCount <= 0) return 1;
  return 1 + Math.ceil(productCount / WALL_QR_LABELS_PER_PAGE);
};
