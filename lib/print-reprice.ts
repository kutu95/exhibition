import { withTransaction } from "./postgres";
import { getPrintPricingBundle } from "./print-papers";
import { computeVariantPricing } from "./print-size";

export type RepriceAllResult = {
  scanned: number;
  updated: number;
  unchanged: number;
  skipped: number;
  /** Variants skipped because paper has no $/sq in rate (or missing size/paper). */
  skippedSampleLabels: string[];
};

type VariantRow = {
  id: string;
  variant_label: string;
  width_mm: number | null;
  height_mm: number | null;
  paper_type: string | null;
  price_aud: number;
  lab_cost_aud: number | null;
};

/**
 * Recalculate price_aud and lab_cost_aud for all print product variants
 * using current base, markup, paper rates, and retail rounding.
 */
export const repriceAllPrintVariants = async (): Promise<RepriceAllResult> => {
  const pricing = await getPrintPricingBundle();

  return withTransaction(async (client) => {
    const { rows } = await client.query<VariantRow>(
      `
        select
          pv.id,
          pv.variant_label,
          pv.width_mm,
          pv.height_mm,
          pv.paper_type,
          pv.price_aud,
          pv.lab_cost_aud
        from exhibition.product_variants pv
        join exhibition.products p on p.id = pv.product_id
        where p.product_type = 'print'
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
      const paper = row.paper_type?.trim() ?? "";

      if (widthMm <= 0 || heightMm <= 0 || !paper) {
        skipped += 1;
        if (skippedSampleLabels.length < 8) {
          skippedSampleLabels.push(row.variant_label || row.id);
        }
        continue;
      }

      const next = computeVariantPricing({
        widthMm,
        heightMm,
        paperLabel: paper,
        markupFactor: pricing.markupFactor,
        basePriceAud: pricing.basePriceAud,
        papers: pricing.papers,
      });

      if (!next) {
        skipped += 1;
        if (skippedSampleLabels.length < 8) {
          skippedSampleLabels.push(row.variant_label || row.id);
        }
        continue;
      }

      if (row.price_aud === next.retailCents && row.lab_cost_aud === next.labCostCents) {
        unchanged += 1;
        continue;
      }

      await client.query(
        `
          update exhibition.product_variants
          set
            price_aud = $2,
            lab_cost_aud = $3
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
