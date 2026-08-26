import { withTransaction } from "./postgres";
import { getOfferPricingBundle } from "./print-offer-bundle";
import {
  computeCustomPrintPricing,
  CUSTOM_LONG_EDGE_ABS_MAX_MM,
  CUSTOM_LONG_EDGE_MIN_MM,
  deriveCustomSizeFromLongEdge,
  maxCustomLongEdgeMm,
  type CustomFrameStyleId,
} from "./print-custom";
import { getMasterFileDimensions } from "./master-files";

export type CreateCustomPrintVariantInput = {
  productId: string;
  longEdgeMm: number;
  mediaId: string;
  frameStyle: CustomFrameStyleId;
  /** Optional override when master file is unavailable. */
  pixelWidth?: number | null;
  pixelHeight?: number | null;
};

export type CreateCustomPrintVariantResult = {
  variant_id: string;
  variant_label: string;
  price_aud: number;
  width_mm: number;
  height_mm: number;
  fulfilment_provider: "pixelperfect";
};

type ProductContext = {
  id: string;
  title: string;
  is_available: boolean;
  product_type: string;
  master_filename: string | null;
  sample_width_mm: number | null;
  sample_height_mm: number | null;
  max_edition_size: number | null;
};

export const createCustomPrintVariant = async (
  input: CreateCustomPrintVariantInput,
): Promise<CreateCustomPrintVariantResult> => {
  if (!Number.isFinite(input.longEdgeMm) || input.longEdgeMm < CUSTOM_LONG_EDGE_MIN_MM) {
    throw new Error("INVALID_LONG_EDGE");
  }
  if (input.longEdgeMm > CUSTOM_LONG_EDGE_ABS_MAX_MM) {
    throw new Error("INVALID_LONG_EDGE");
  }

  const pricing = await getOfferPricingBundle();

  return withTransaction(async (client) => {
    const { rows } = await client.query<ProductContext>(
      `
        select
          p.id,
          p.title,
          p.is_available,
          p.product_type,
          (
            select pv.master_filename
            from exhibition.product_variants pv
            where pv.product_id = p.id and pv.master_filename is not null
            order by pv.is_active desc, pv.created_at asc
            limit 1
          ) as master_filename,
          (
            select pv.width_mm
            from exhibition.product_variants pv
            where pv.product_id = p.id
              and pv.width_mm is not null and pv.height_mm is not null
              and pv.width_mm > 0 and pv.height_mm > 0
            order by pv.is_active desc, pv.created_at asc
            limit 1
          ) as sample_width_mm,
          (
            select pv.height_mm
            from exhibition.product_variants pv
            where pv.product_id = p.id
              and pv.width_mm is not null and pv.height_mm is not null
              and pv.width_mm > 0 and pv.height_mm > 0
            order by pv.is_active desc, pv.created_at asc
            limit 1
          ) as sample_height_mm,
          (
            select max(pv.edition_size)
            from exhibition.product_variants pv
            where pv.product_id = p.id
          ) as max_edition_size
        from exhibition.products p
        where p.id = $1
      `,
      [input.productId],
    );

    const product = rows[0];
    if (!product || product.product_type !== "print" || !product.is_available) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    let pixelWidth = input.pixelWidth ?? null;
    let pixelHeight = input.pixelHeight ?? null;

    if ((!pixelWidth || !pixelHeight) && product.master_filename) {
      const dims = await getMasterFileDimensions(product.master_filename).catch(() => null);
      if (dims) {
        pixelWidth = dims.pixel_width;
        pixelHeight = dims.pixel_height;
      }
    }

    if ((!pixelWidth || !pixelHeight) && product.sample_width_mm && product.sample_height_mm) {
      pixelWidth = product.sample_width_mm;
      pixelHeight = product.sample_height_mm;
    }

    if (!pixelWidth || !pixelHeight || pixelWidth <= 0 || pixelHeight <= 0) {
      throw new Error("PRODUCT_PIXELS_UNAVAILABLE");
    }

    if (input.longEdgeMm > maxCustomLongEdgeMm(pixelWidth, pixelHeight)) {
      throw new Error("INVALID_LONG_EDGE");
    }

    const size = deriveCustomSizeFromLongEdge(input.longEdgeMm, pixelWidth, pixelHeight);
    const priced = computeCustomPrintPricing({
      widthMm: size.width_mm,
      heightMm: size.height_mm,
      mediaId: input.mediaId,
      frameStyle: input.frameStyle,
      mediaMarkupFactor: pricing.markupFactor,
      mediaBasePriceAud: pricing.basePriceAud,
      frameMarkupFactor: pricing.frameMarkupFactor,
      frameBasePriceAud: pricing.frameBasePriceAud,
      frameRates: pricing.frameRates,
      rthCanvasRates: pricing.rthCanvasRates,
      papers: pricing.papers,
    });

    if (!priced) {
      throw new Error("CUSTOM_PRICE_UNAVAILABLE");
    }

    const { rows: inserted } = await client.query<{ id: string }>(
      `
        insert into exhibition.product_variants (
          product_id,
          variant_label,
          width_mm,
          height_mm,
          border_mm,
          paper_type,
          print_type,
          price_aud,
          edition_size,
          master_filename,
          source_print_profile_id,
          destination_print_profile_id,
          stripe_price_id,
          stock_quantity,
          is_active,
          tier_label,
          finish,
          is_framed,
          frame_type,
          print_dpi,
          lab_cost_aud,
          suggested_retail_min_aud,
          suggested_retail_max_aud,
          turnaround_days_min,
          turnaround_days_max,
          shipping_class,
          fulfilment_notes,
          fulfilment_provider,
          fulfilment_class,
          supplier_product_code,
          aspect_ratio,
          canvas_wrap_mm,
          wrap_style,
          front_face_width_mm,
          front_face_height_mm,
          fit_mode,
          crop_offset,
          size_lock
        )
        values (
          $1, $2, $3, $4, 0, $5, $6, $7, $8, $9,
          null, null, null, null, true,
          'Custom', $10, $11, $12, 300, $13,
          null, null, null, null, 'pixelperfect', $14, 'pixelperfect', $16, $17, $15,
          null, null, null, null,
          'custom_size', 0, 'long_edge'
        )
        returning id
      `,
      [
        product.id,
        priced.variantLabel,
        priced.widthMm,
        priced.heightMm,
        priced.paperType,
        priced.printType,
        priced.retailCents,
        product.max_edition_size ?? 25,
        product.master_filename,
        priced.mediaLabel,
        priced.isFramed,
        priced.frameType,
        priced.labCostCents,
        priced.fulfilmentNotes,
        size.aspect_ratio,
        priced.fulfilment_class,
        priced.supplier_product_code,
      ],
    );

    const variantId = inserted[0]?.id;
    if (!variantId) throw new Error("VARIANT_INSERT_FAILED");

    return {
      variant_id: variantId,
      variant_label: priced.variantLabel,
      price_aud: priced.retailCents,
      width_mm: priced.widthMm,
      height_mm: priced.heightMm,
      fulfilment_provider: "pixelperfect",
    };
  });
};
