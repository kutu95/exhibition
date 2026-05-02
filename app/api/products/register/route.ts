import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerApiKey } from "../../../../lib/api-key-auth";
import { withTransaction } from "../../../../lib/postgres";
import { stripe } from "../../../../lib/stripe";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

export const runtime = "nodejs";

const locationOptions = ["Calgardup Bay", "Redgate Beach", "Isaac Rock", "SS Georgette Wreck"] as const;
const installationOptions = ["Cubarama", "Captain Godfrey AI", "Drift"] as const;

const registerProductSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  location_tag: z.enum(locationOptions).nullable(),
  installation_tag: z.enum(installationOptions).nullable(),
  is_featured: z.boolean(),
  edition_size: z.number().int().positive(),
  master_filename: z.string().min(1),
  web_image_url: z.string().url(),
});

type ProductRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  product_type: "print";
  location_tag: string | null;
  installation_tag: string | null;
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

export async function POST(request: Request) {
  if (!verifyBearerApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = registerProductSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product registration payload." }, { status: 400 });
  }

  const payload = parsed.data;

  try {
    const created = await withTransaction(async (client) => {
      const { rows: productRows } = await client.query<ProductRow>(
        `
          insert into exhibition.products (
            title,
            slug,
            description,
            product_type,
            location_tag,
            installation_tag,
            is_available,
            is_featured
          )
          values ($1, $2, $3, 'print', $4, $5, true, $6)
          returning *
        `,
        [
          payload.title,
          payload.slug,
          payload.description,
          payload.location_tag,
          payload.installation_tag,
          payload.is_featured,
        ],
      );

      const product = productRows[0];

      const { rows: variantRows } = await client.query<VariantRow>(
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
            stripe_price_id,
            stock_quantity,
            is_active
          )
          select
            $1,
            variant_label,
            width_mm,
            height_mm,
            border_mm,
            paper_type,
            print_type,
            base_price_aud,
            $2,
            $3,
            null,
            null,
            true
          from exhibition.variant_templates
          where is_active = true
          order by sort_order asc, created_at asc
          returning *
        `,
        [product.id, payload.edition_size, payload.master_filename],
      );

      if (variantRows.length === 0) {
        throw new Error("NO_ACTIVE_VARIANT_TEMPLATES");
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
        [product.id, payload.web_image_url, payload.title],
      );

      return {
        ...product,
        product_variants: variantRows,
        product_images: imageRows,
      };
    });

    const variantsWithStripePrices = await Promise.all(
      created.product_variants.map(async (variant) => {
        const stripeProduct = await stripe.products.create({
          name: `${created.title} — ${variant.variant_label}`,
          metadata: {
            product_id: created.id,
            variant_id: variant.id,
          },
        });

        const stripePrice = await stripe.prices.create({
          unit_amount: variant.price_aud,
          currency: "aud",
          product: stripeProduct.id,
          metadata: {
            variant_id: variant.id,
          },
        });

        const { error } = await supabaseAdmin
          .from("product_variants")
          .update({ stripe_price_id: stripePrice.id })
          .eq("id", variant.id);

        if (error) {
          throw error;
        }

        return {
          ...variant,
          stripe_price_id: stripePrice.id,
        };
      }),
    );

    return NextResponse.json(
      {
        ok: true,
        product_id: created.id,
        variants_created: variantsWithStripePrices.length,
        ...created,
        product_variants: variantsWithStripePrices,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NO_ACTIVE_VARIANT_TEMPLATES") {
      return NextResponse.json({ error: "No active variant templates found." }, { status: 500 });
    }

    console.error("Product registration failed", error);
    return NextResponse.json({ error: "Failed to register product." }, { status: 500 });
  }
}
