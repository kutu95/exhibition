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

/** Fields the public shop grid needs. Omitting transcripts and print-file metadata keeps /shop HTML crawlable. */
export type ShopCatalogVariant = {
  id: string;
  variant_label: string;
  price_aud: number;
  is_active: boolean;
  fulfilment_provider: ProductVariant["fulfilment_provider"];
  fulfilment_class: ProductVariant["fulfilment_class"];
  finish: string | null;
  print_type: string | null;
  is_framed: boolean;
  tier_label: string | null;
};

export type ShopCatalogProduct = {
  id: string;
  slug: string;
  title: string;
  product_type: Product["product_type"];
  location_tag: string | null;
  visibility: Product["visibility"];
  gallery_id: string | null;
  product_images: Array<{ image_url: string; alt_text: string | null }>;
  product_themes: Array<{ theme: { slug: string; name: string; is_active: boolean } }>;
  product_variants: ShopCatalogVariant[];
};

export const toShopCatalogProduct = (product: ProductWithVariantsAndImages): ShopCatalogProduct => ({
  id: product.id,
  slug: product.slug,
  title: product.title,
  product_type: product.product_type,
  location_tag: product.location_tag,
  visibility: product.visibility,
  gallery_id: product.gallery_id,
  product_images: product.product_images.map((image) => ({
    image_url: image.image_url,
    alt_text: image.alt_text,
  })),
  product_themes: product.product_themes.flatMap((assignment) => {
    const theme = assignment.theme;
    if (!theme?.slug) return [];
    return [
      {
        theme: {
          slug: theme.slug,
          name: theme.name,
          is_active: theme.is_active !== false,
        },
      },
    ];
  }),
  product_variants: product.product_variants.map((variant) => ({
    id: variant.id,
    variant_label: variant.variant_label,
    price_aud: variant.price_aud,
    is_active: variant.is_active,
    fulfilment_provider: variant.fulfilment_provider,
    fulfilment_class: variant.fulfilment_class,
    finish: variant.finish,
    print_type: variant.print_type,
    is_framed: variant.is_framed,
    tier_label: variant.tier_label,
  })),
});

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
