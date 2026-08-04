import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomPrintClient } from "../../../../components/CustomPrintClient";
import { isProductVisibleInCatalog, mapProductRow } from "../../../../lib/catalog-products";
import { getMasterFileDimensions } from "../../../../lib/master-files";
import { buildMetadata } from "../../../../lib/metadata";
import { SHOW_CUSTOM_PRINT_PAGE } from "../../../../lib/print-custom";
import { getOfferPricingBundle } from "../../../../lib/print-offer-bundle";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import type { Product, ProductImage, ProductTheme, ProductVariant } from "../../../../lib/supabase/types";
import { hasActiveVaultSession } from "../../../../lib/vault-access";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type ProductRow = Product & {
  product_variants: ProductVariant[] | null;
  product_images: ProductImage[] | null;
  product_themes: ProductTheme[] | null;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!SHOW_CUSTOM_PRINT_PAGE) {
    return buildMetadata({ title: "Custom print", noIndex: true });
  }
  const { slug } = await params;
  return buildMetadata({
    title: `Custom print · ${slug}`,
    description: "Choose custom size, media, and framing for this exhibition print.",
    noIndex: true,
  });
}

export default async function CustomPrintPage({ params }: PageProps) {
  if (!SHOW_CUSTOM_PRINT_PAGE) {
    notFound();
  }

  const { slug } = await params;
  const [supabase, includeVault, pricing] = await Promise.all([
    createSupabaseServerClient(),
    hasActiveVaultSession(),
    getOfferPricingBundle(),
  ]);

  const { data, error } = await supabase
    .from("products")
    .select("*, product_variants(*), product_images(*), product_themes(*, theme:themes(*))")
    .eq("slug", slug)
    .eq("is_available", true)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  // Include inactive variants so we can still resolve master_filename / aspect sample.
  const raw = data as ProductRow;
  const product = mapProductRow(raw);
  if (!isProductVisibleInCatalog(product, includeVault) || product.product_type !== "print") {
    notFound();
  }

  const allVariants = raw.product_variants ?? [];
  const masterFilename =
    allVariants.find((variant) => variant.master_filename)?.master_filename ?? null;
  const sample = allVariants.find(
    (variant) => variant.width_mm && variant.height_mm && variant.width_mm > 0 && variant.height_mm > 0,
  );

  let pixelWidth = sample?.width_mm ?? null;
  let pixelHeight = sample?.height_mm ?? null;

  if (masterFilename) {
    const dims = await getMasterFileDimensions(masterFilename).catch(() => null);
    if (dims) {
      pixelWidth = dims.pixel_width;
      pixelHeight = dims.pixel_height;
    }
  }

  if (!pixelWidth || !pixelHeight) {
    notFound();
  }

  const primaryImage =
    product.product_images.find((image) => image.is_primary)?.image_url ??
    product.product_images[0]?.image_url;
  if (!primaryImage) {
    notFound();
  }

  const editionSize = product.product_variants
    .map((variant) => variant.edition_size)
    .filter((size): size is number => typeof size === "number")
    .reduce<number | null>((max, size) => (max === null || size > max ? size : max), null);

  // Prefer edition from any variant including inactive
  const editionFromAll = allVariants
    .map((variant) => variant.edition_size)
    .filter((size): size is number => typeof size === "number");
  const edition =
    editionFromAll.length > 0 ? Math.max(...editionFromAll) : editionSize;

  return (
    <CustomPrintClient
      product={{
        id: product.id,
        slug: product.slug,
        title: product.title,
        location_tag: product.location_tag,
        image_url: primaryImage,
      }}
      pixelWidth={pixelWidth}
      pixelHeight={pixelHeight}
      editionSize={edition}
      mediaMarkupFactor={pricing.markupFactor}
      mediaBasePriceAud={pricing.basePriceAud}
      frameMarkupFactor={pricing.frameMarkupFactor}
      frameBasePriceAud={pricing.frameBasePriceAud}
      frameRates={pricing.frameRates}
      rthCanvasRates={pricing.rthCanvasRates}
      papers={pricing.papers}
    />
  );
}
