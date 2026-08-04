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
    product_variants: (product.product_variants ?? []).filter((variant) => variant.is_active),
    product_images: sortedImages,
    product_themes: product.product_themes ?? [],
  };
};

export const isProductVisibleInCatalog = (
  product: Pick<Product, "visibility">,
  includeVault: boolean,
): boolean => product.visibility !== "vault" || includeVault;
