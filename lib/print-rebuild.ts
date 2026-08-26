import type { PoolClient } from "pg";

import { getMasterFileDimensions } from "./master-files";
import { withTransaction } from "./postgres";
import { getOfferPricingBundle } from "./print-offer-bundle";
import {
  buildOfferVariantsForProduct,
  OFFER_COMBOS,
  parseOfferAxesFromVariant,
  type OfferVariantDraft,
} from "./print-offer";
import { computeOfferVariantPricing } from "./print-offer";

export type RebuildPrintOptionsResult = {
  productsScanned: number;
  productsRebuilt: number;
  productsSkipped: number;
  variantsDeactivated: number;
  variantsCreated: number;
  skippedSampleTitles: string[];
};

export type RepriceOfferResult = {
  scanned: number;
  updated: number;
  unchanged: number;
  skipped: number;
  skippedSampleLabels: string[];
};

type ProductRebuildRow = {
  id: string;
  title: string;
  edition_size: number | null;
  master_filename: string | null;
  sample_width_mm: number | null;
  sample_height_mm: number | null;
  max_edition_size: number | null;
};

type VariantRepriceRow = {
  id: string;
  variant_label: string;
  width_mm: number | null;
  height_mm: number | null;
  finish: string | null;
  tier_label: string | null;
  is_framed: boolean | null;
  fulfilment_class: string | null;
  price_aud: number;
  lab_cost_aud: number | null;
  is_active: boolean;
};

const VARIANT_INSERT_SQL = `
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
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    null, null, null, null, true,
    $11, $12, $13, $14, $15, $16, null, null, null, null, $22, $17, $23, $24, $25, $18,
    null, null, null, null,
    $19, $20, $21
  )
  returning id
`;

export const insertOfferDrafts = async (
  client: PoolClient,
  productId: string,
  masterFilename: string | null,
  drafts: OfferVariantDraft[],
): Promise<number> => {
  let created = 0;
  for (const draft of drafts) {
    await client.query(VARIANT_INSERT_SQL, [
      productId,
      draft.variant_label,
      draft.width_mm,
      draft.height_mm,
      draft.border_mm,
      draft.paper_type,
      draft.print_type,
      draft.price_aud,
      draft.edition_size,
      masterFilename,
      draft.tier_label,
      draft.finish,
      draft.is_framed,
      draft.frame_type,
      draft.print_dpi,
      draft.lab_cost_aud,
      draft.fulfilment_notes,
      draft.aspect_ratio,
      draft.fit_mode,
      draft.crop_offset,
      draft.size_lock,
      draft.shipping_class,
      draft.fulfilment_provider,
      draft.fulfilment_class,
      draft.supplier_product_code,
    ]);
    created += 1;
  }
  return created;
};

const resolvePixelDimensions = async (row: ProductRebuildRow): Promise<{
  pixelWidth: number;
  pixelHeight: number;
} | null> => {
  if (row.master_filename) {
    const dims = await getMasterFileDimensions(row.master_filename).catch(() => null);
    if (dims?.pixel_width && dims?.pixel_height) {
      return { pixelWidth: dims.pixel_width, pixelHeight: dims.pixel_height };
    }
  }

  // Fall back to aspect from an existing variant (scale units cancel in deriveAspectPreservingSizeMm).
  if (row.sample_width_mm && row.sample_height_mm && row.sample_width_mm > 0 && row.sample_height_mm > 0) {
    return { pixelWidth: row.sample_width_mm, pixelHeight: row.sample_height_mm };
  }

  return null;
};

/**
 * Soft-deactivate all print variants and insert the 9-SKU offer matrix for each print product.
 */
export const rebuildAllPrintOfferVariants = async (): Promise<RebuildPrintOptionsResult> => {
  const pricing = await getOfferPricingBundle();

  const { rows: productRows } = await withTransaction(async (client) => {
    return client.query<ProductRebuildRow>(
      `
        select
          p.id,
          p.title,
          null::int as edition_size,
          (
            select pv.master_filename
            from exhibition.product_variants pv
            where pv.product_id = p.id
              and pv.master_filename is not null
            order by pv.is_active desc, pv.created_at asc
            limit 1
          ) as master_filename,
          (
            select pv.width_mm
            from exhibition.product_variants pv
            where pv.product_id = p.id
              and pv.width_mm is not null
              and pv.height_mm is not null
              and pv.width_mm > 0
              and pv.height_mm > 0
            order by pv.is_active desc, pv.created_at asc
            limit 1
          ) as sample_width_mm,
          (
            select pv.height_mm
            from exhibition.product_variants pv
            where pv.product_id = p.id
              and pv.width_mm is not null
              and pv.height_mm is not null
              and pv.width_mm > 0
              and pv.height_mm > 0
            order by pv.is_active desc, pv.created_at asc
            limit 1
          ) as sample_height_mm,
          (
            select max(pv.edition_size)
            from exhibition.product_variants pv
            where pv.product_id = p.id
          ) as max_edition_size
        from exhibition.products p
        where p.product_type = 'print'
        order by p.created_at asc
      `,
    );
  });

  let productsRebuilt = 0;
  let productsSkipped = 0;
  let variantsDeactivated = 0;
  let variantsCreated = 0;
  const skippedSampleTitles: string[] = [];

  for (const product of productRows) {
    const pixels = await resolvePixelDimensions(product);
    if (!pixels) {
      productsSkipped += 1;
      if (skippedSampleTitles.length < 8) skippedSampleTitles.push(product.title);
      continue;
    }

    const editionSize = product.max_edition_size ?? 25;
    let drafts: OfferVariantDraft[];
    try {
      drafts = buildOfferVariantsForProduct({
        pixelWidth: pixels.pixelWidth,
        pixelHeight: pixels.pixelHeight,
        editionSize,
        mediaMarkupFactor: pricing.markupFactor,
        mediaBasePriceAud: pricing.basePriceAud,
        frameMarkupFactor: pricing.frameMarkupFactor,
        frameBasePriceAud: pricing.frameBasePriceAud,
        frameRates: pricing.frameRates,
        rthCanvasRates: pricing.rthCanvasRates,
        posterfactory: pricing.posterfactory,
      });
    } catch {
      productsSkipped += 1;
      if (skippedSampleTitles.length < 8) skippedSampleTitles.push(product.title);
      continue;
    }

    await withTransaction(async (client) => {
      const deactivated = await client.query(
        `
          update exhibition.product_variants
          set is_active = false
          where product_id = $1
            and is_active = true
        `,
        [product.id],
      );
      variantsDeactivated += deactivated.rowCount ?? 0;
      variantsCreated += await insertOfferDrafts(client, product.id, product.master_filename, drafts);
    });

    productsRebuilt += 1;
  }

  return {
    productsScanned: productRows.length,
    productsRebuilt,
    productsSkipped,
    variantsDeactivated,
    variantsCreated,
    skippedSampleTitles,
  };
};

export const rebuildPrintOfferVariantsForProduct = async (
  productId: string,
): Promise<{ deactivated: number; created: number }> => {
  const pricing = await getOfferPricingBundle();

  return withTransaction(async (client) => {
    const { rows } = await client.query<ProductRebuildRow>(
      `
        select
          p.id,
          p.title,
          null::int as edition_size,
          (
            select pv.master_filename
            from exhibition.product_variants pv
            where pv.product_id = p.id
              and pv.master_filename is not null
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
        where p.id = $1 and p.product_type = 'print'
      `,
      [productId],
    );

    const product = rows[0];
    if (!product) throw new Error("PRODUCT_NOT_FOUND");

    const pixels = await resolvePixelDimensions(product);
    if (!pixels) throw new Error("PRODUCT_PIXELS_UNAVAILABLE");

    const drafts = buildOfferVariantsForProduct({
      pixelWidth: pixels.pixelWidth,
      pixelHeight: pixels.pixelHeight,
      editionSize: product.max_edition_size ?? 25,
      mediaMarkupFactor: pricing.markupFactor,
      mediaBasePriceAud: pricing.basePriceAud,
      frameMarkupFactor: pricing.frameMarkupFactor,
      frameBasePriceAud: pricing.frameBasePriceAud,
      frameRates: pricing.frameRates,
      rthCanvasRates: pricing.rthCanvasRates,
      posterfactory: pricing.posterfactory,
    });

    const deactivated = await client.query(
      `
        update exhibition.product_variants
        set is_active = false
        where product_id = $1 and is_active = true
      `,
      [productId],
    );

    const created = await insertOfferDrafts(client, productId, product.master_filename, drafts);
    return { deactivated: deactivated.rowCount ?? 0, created };
  });
};

/**
 * Recalculate prices for active offer variants (and any offer-shaped inactive ones we still touch).
 * Uses finish / framed axes when parseable; otherwise skips.
 */
export const repriceAllPrintVariants = async (): Promise<RepriceOfferResult> => {
  const pricing = await getOfferPricingBundle();

  return withTransaction(async (client) => {
    const { rows } = await client.query<VariantRepriceRow>(
      `
        select
          pv.id,
          pv.variant_label,
          pv.width_mm,
          pv.height_mm,
          pv.finish,
          pv.tier_label,
          pv.is_framed,
          pv.fulfilment_class,
          pv.price_aud,
          pv.lab_cost_aud,
          pv.is_active
        from exhibition.product_variants pv
        join exhibition.products p on p.id = pv.product_id
        where p.product_type = 'print'
          and pv.is_active = true
        order by pv.created_at asc
      `,
    );

    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    const skippedSampleLabels: string[] = [];

    for (const row of rows) {
      const widthMm = row.width_mm ?? 0;
      const heightMm = row.height_mm ?? 0;
      const axes = parseOfferAxesFromVariant(row);

      if (widthMm <= 0 || heightMm <= 0 || !axes) {
        skipped += 1;
        if (skippedSampleLabels.length < 8) skippedSampleLabels.push(row.variant_label || row.id);
        continue;
      }

      const next = computeOfferVariantPricing({
        widthMm,
        heightMm,
        classId: axes.classId,
        sizeId: axes.sizeId,
        mediaMarkupFactor: pricing.markupFactor,
        mediaBasePriceAud: pricing.basePriceAud,
        frameMarkupFactor: pricing.frameMarkupFactor,
        frameBasePriceAud: pricing.frameBasePriceAud,
        frameRates: pricing.frameRates,
        rthCanvasRates: pricing.rthCanvasRates,
        posterfactory: pricing.posterfactory,
      });

      if (!next) {
        skipped += 1;
        if (skippedSampleLabels.length < 8) skippedSampleLabels.push(row.variant_label || row.id);
        continue;
      }

      if (row.price_aud === next.retailCents && row.lab_cost_aud === next.labCostCents) {
        unchanged += 1;
        continue;
      }

      await client.query(
        `
          update exhibition.product_variants
          set price_aud = $2, lab_cost_aud = $3
          where id = $1
        `,
        [row.id, next.retailCents, next.labCostCents],
      );
      updated += 1;
    }

    return {
      scanned: rows.length,
      updated,
      unchanged,
      skipped,
      skippedSampleLabels,
    };
  });
};

export { OFFER_COMBOS };
