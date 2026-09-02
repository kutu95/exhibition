import type {
  Product,
  ProductImage,
  ProductTheme,
  ProductVariant,
  ProductWithVariantsAndImages,
} from "./supabase/types";

type ProductRow = Product & {
  product_variants: ProductVariant[] | null;
  product_images: ProductImage[] | null;
  product_themes: ProductTheme[] | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const mapProductRow = (
  product: ProductRow,
  options: { primaryImagesOnly?: boolean } = {},
): ProductWithVariantsAndImages => {
  const images = product.product_images ?? [];
  const sortedImages = options.primaryImagesOnly
    ? images.filter((image) => image.is_primary).sort((a, b) => a.sort_order - b.sort_order)
    : [...images].sort((a, b) => a.sort_order - b.sort_order);

  return {
    ...product,
    visibility: product.visibility ?? "public",
    gallery_id: product.gallery_id ?? null,
    audio_url: product.audio_url ?? null,
    audio_duration: product.audio_duration ?? null,
    audio_transcript: product.audio_transcript ?? null,
    product_variants: (product.product_variants ?? []).filter((variant) => variant.is_active),
    product_images: sortedImages,
    product_themes: product.product_themes ?? [],
  };
};

export const isProductVisibleInCatalog = (
  product: Pick<Product, "visibility" | "gallery_id">,
  allowedGalleryIds: ReadonlySet<string>,
): boolean => {
  if (product.visibility !== "vault") return true;
  return Boolean(product.gallery_id && allowedGalleryIds.has(product.gallery_id));
};

type FilterableQuery<T> = {
  eq: (column: string, value: string) => T;
  or: (filters: string) => T;
};

export const applyCatalogVisibilityFilter = <T>(
  query: FilterableQuery<T>,
  allowedGalleryIds: ReadonlySet<string>,
): T => {
  const ids = [...allowedGalleryIds].filter((id) => UUID_PATTERN.test(id));
  if (ids.length === 0) {
    return query.eq("visibility", "public");
  }

  return query.or(`visibility.eq.public,gallery_id.in.(${ids.join(",")})`);
};
