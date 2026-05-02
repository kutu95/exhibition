import { NextResponse } from "next/server";

import { queryPostgres } from "../../../lib/postgres";

export const runtime = "nodejs";

type PrintProductsRow = {
  products: Array<{
    product_id: string;
    title: string;
    slug: string;
    location_tag: string | null;
    variants: Array<{
      variant_id: string;
      variant_label: string;
      width_mm: number | null;
      height_mm: number | null;
      border_mm: number;
      paper_type: string | null;
      print_type: string | null;
      master_filename: string | null;
      price_aud: number;
      edition_size: number | null;
      editions_remaining: number | null;
      is_active: boolean;
      is_sold_out: boolean;
    }>;
  }>;
};

export async function GET() {
  try {
    const { rows } = await queryPostgres<PrintProductsRow>(`
      with edition_counts as (
        select variant_id, count(*)::integer as lock_count
        from exhibition.edition_locks
        group by variant_id
      ),
      product_rows as (
        select
          p.id,
          json_build_object(
            'product_id', p.id,
            'title', p.title,
            'slug', p.slug,
            'location_tag', p.location_tag,
            'variants', coalesce(
              json_agg(
                json_build_object(
                  'variant_id', pv.id,
                  'variant_label', pv.variant_label,
                  'width_mm', pv.width_mm,
                  'height_mm', pv.height_mm,
                  'border_mm', pv.border_mm,
                  'paper_type', pv.paper_type,
                  'print_type', pv.print_type,
                  'master_filename', pv.master_filename,
                  'price_aud', pv.price_aud,
                  'edition_size', pv.edition_size,
                  'editions_remaining',
                    case
                      when pv.edition_size is null then null
                      else greatest(pv.edition_size - coalesce(ec.lock_count, 0), 0)
                    end,
                  'is_active', pv.is_active,
                  'is_sold_out',
                    case
                      when pv.edition_size is null then false
                      else greatest(pv.edition_size - coalesce(ec.lock_count, 0), 0) = 0
                    end
                )
                order by pv.created_at asc
              ) filter (where pv.id is not null),
              '[]'::json
            )
          ) as product
        from exhibition.products p
        left join exhibition.product_variants pv
          on pv.product_id = p.id
          and pv.is_active = true
        left join edition_counts ec on ec.variant_id = pv.id
        where p.is_available = true
          and p.product_type = 'print'
        group by p.id, p.title, p.slug, p.location_tag
        order by p.created_at desc
      )
      select coalesce(json_agg(product), '[]'::json) as products
      from product_rows
    `);

    return NextResponse.json({
      products: rows[0]?.products ?? [],
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Print products query failed", error);
    return NextResponse.json({ error: "Failed to fetch print products." }, { status: 500 });
  }
}
