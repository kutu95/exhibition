import { productGalleryFields } from "./galleries";
import { withTransaction } from "./postgres";
import { getOfferPricingBundle } from "./print-offer-bundle";
import { applyOfferSelection, buildOfferVariantsForProduct, type OfferSelectionItem } from "./print-offer";
import { insertOfferDrafts } from "./print-rebuild";
import type { VariantFramingInput } from "./print-framing";
import type { PrintTypeCode } from "./print-catalogue";

/** @deprecated Legacy paper × long-edge specs — Import Wizard now uses the fixed offer matrix. */
export type CustomSizeVariantSpec = {
  paper_type: string;
  print_type?: PrintTypeCode | null;
  long_edge_mm: number;
  price_aud?: number | null;
  border_mm?: number;
  print_dpi?: number;
  finish?: string | null;
  edition_size?: number | null;
  tier_label?: string | null;
};

export type RegisterPrintProductPayload = {
  title: string;
  slug: string;
  description: string | null;
  location_tag: string | null;
  credit_attribution?: string | null;
  installation_tag: "Cubarama" | "Captain Godfrey AI" | "Drift" | null;
  photo_type_tag: "Still camera" | "Drone" | "Underwater" | null;
  is_featured: boolean;
  edition_size: number;
  master_filename: string;
  web_image_url: string;
  visibility?: "public" | "vault";
  gallery_id?: string | null;
  theme_ids?: string[];
  /** @deprecated Ignored — offer matrix is always used. */
  variant_template_ids?: string[];
  /** @deprecated Ignored. */
  variant_template_prices?: Record<string, number>;
  /** @deprecated Ignored. */
  variant_framing?: Record<string, VariantFramingInput>;
  /** @deprecated Ignored — offer matrix is always used when pixels are present. */
  custom_size_variants?: CustomSizeVariantSpec[];
  master_pixel_width?: number | null;
  master_pixel_height?: number | null;
  /** Subset of the standard offer. Omit to create all priced SKUs. */
  offer_selection?: OfferSelectionItem[] | null;
};

type ProductRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  product_type: "print";
  location_tag: string | null;
  credit_attribution: string | null;
  installation_tag: string | null;
  photo_type_tag: string | null;
  is_available: boolean;
  is_featured: boolean;
  created_at: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  variant_label: string;
  price_aud: number;
  edition_size: number | null;
  edition_number: number | null;
  stripe_price_id: string | null;
  stock_quantity: number | null;
  is_active: boolean;
  created_at: string;
  width_mm: number | null;
  height_mm: number | null;
  border_mm: number;
  paper_type: string | null;
  print_type: string | null;
  master_filename: string | null;
};

type ImageRow = {
  id: string;
  product_id: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

export const isStripeConfigurationError = (error: unknown): boolean =>
  error instanceof Error &&
  (error.message === "Missing STRIPE_SECRET_KEY" ||
    ("type" in error && error.type === "StripeAuthenticationError"));

export const isDuplicateProductSlugError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "23505" &&
  "constraint" in error &&
  error.constraint === "products_slug_key";

export const normalizeManagedImageUrl = (value: string): string => {
  if (value.startsWith("/images/")) {
    return value;
  }

  try {
    const url = new URL(value);
    if (url.pathname.startsWith("/images/")) {
      return url.pathname;
    }
  } catch {
    // Leave non-URL values untouched; callers validate external URLs where needed.
  }

  return value;
};

export const registerPrintProduct = async (payload: RegisterPrintProductPayload) => {
  const webImageUrl = normalizeManagedImageUrl(payload.web_image_url);
  const masterPixelWidth = payload.master_pixel_width ?? null;
  const masterPixelHeight = payload.master_pixel_height ?? null;

  if (!masterPixelWidth || !masterPixelHeight || masterPixelWidth <= 0 || masterPixelHeight <= 0) {
    throw new Error("MASTER_PIXELS_REQUIRED_FOR_CUSTOM_SIZE");
  }

  const pricing = await getOfferPricingBundle();
  const drafts = applyOfferSelection(
    buildOfferVariantsForProduct({
      pixelWidth: masterPixelWidth,
      pixelHeight: masterPixelHeight,
      editionSize: payload.edition_size,
      mediaMarkupFactor: pricing.markupFactor,
      mediaBasePriceAud: pricing.basePriceAud,
      frameMarkupFactor: pricing.frameMarkupFactor,
      frameBasePriceAud: pricing.frameBasePriceAud,
      frameRates: pricing.frameRates,
      rthCanvasRates: pricing.rthCanvasRates,
      posterfactory: pricing.posterfactory,
    }),
    payload.offer_selection,
  );

  return withTransaction(async (client) => {
    const gallery = productGalleryFields(payload.gallery_id);
    const { rows: productRows } = await client.query<ProductRow>(
      `
        insert into exhibition.products (
          title,
          slug,
          description,
          product_type,
          location_tag,
          credit_attribution,
          installation_tag,
          photo_type_tag,
          is_available,
          is_featured,
          visibility,
          gallery_id
        )
        values ($1, $2, $3, 'print', $4, $5, $6, $7, true, $8, $9, $10)
        returning *
      `,
      [
        payload.title,
        payload.slug,
        payload.description,
        payload.location_tag,
        payload.credit_attribution?.trim() || null,
        payload.installation_tag,
        payload.photo_type_tag,
        payload.is_featured,
        gallery.visibility,
        gallery.gallery_id,
      ],
    );

    const product = productRows[0];

    if (payload.theme_ids?.length) {
      await client.query(
        `
          insert into exhibition.product_themes (product_id, theme_id)
          select $1, unnest($2::uuid[])
        `,
        [product.id, payload.theme_ids],
      );
    }

    await insertOfferDrafts(client, product.id, payload.master_filename, drafts);

    const { rows: variantRows } = await client.query<VariantRow>(
      `
        select *
        from exhibition.product_variants
        where product_id = $1 and is_active = true
        order by created_at asc
      `,
      [product.id],
    );

    if (variantRows.length === 0) {
      throw new Error("NO_VARIANTS_CREATED");
    }

    const { rows: imageRows } = await client.query<ImageRow>(
      `
        insert into exhibition.product_images (
          product_id,
          image_url,
          alt_text,
          is_primary,
          sort_order
        )
        values ($1, $2, $3, true, 0)
        returning *
      `,
      [product.id, webImageUrl, payload.title],
    );

    return {
      ...product,
      product_variants: variantRows,
      product_images: imageRows,
    };
  });
};
