import { NextResponse } from "next/server";
import { z } from "zod";

import { isProductVisibleInCatalog } from "../../../../lib/catalog-products";
import { queryPostgres } from "../../../../lib/postgres";
import {
  arePurchasesAllowedForRequest,
  PURCHASES_DISABLED_MESSAGE,
} from "../../../../lib/purchases-access";
import { stripe } from "../../../../lib/stripe";
import { allowedGalleryIdSet, getVaultSessionAccessFromRequest } from "../../../../lib/vault-access";

export const runtime = "nodejs";

const checkoutSessionSchema = z.object({
  variant_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  customer_email: z.string().email().optional(),
});

type VariantCheckoutRow = {
  id: string;
  variant_label: string;
  price_aud: number;
  product_title: string;
  visibility: "public" | "vault";
  gallery_id: string | null;
  edition_size: number | null;
  editions_remaining: number | null;
};

export async function POST(request: Request) {
  try {
    if (!arePurchasesAllowedForRequest(request)) {
      return NextResponse.json({ error: PURCHASES_DISABLED_MESSAGE }, { status: 403 });
    }

    const payload = await request.json();
    const parsed = checkoutSessionSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout payload." }, { status: 400 });
    }

    const { variant_id, quantity, customer_email } = parsed.data;
    const allowedGalleryIds = allowedGalleryIdSet(await getVaultSessionAccessFromRequest(request));

    const { rows } = await queryPostgres<VariantCheckoutRow>(
      `
        select
          pv.id,
          pv.variant_label,
          pv.price_aud,
          p.title as product_title,
          p.visibility,
          p.gallery_id,
          pv.edition_size,
          case
            when pv.edition_size is null then null
            else greatest(pv.edition_size - count(el.id)::integer, 0)
          end as editions_remaining
        from exhibition.product_variants pv
        join exhibition.products p on p.id = pv.product_id
        left join exhibition.edition_locks el on el.variant_id = pv.id
        where pv.id = $1
          and pv.is_active = true
          and p.is_available = true
        group by pv.id, p.title, p.visibility, p.gallery_id
        limit 1
      `,
      [variant_id],
    );

    const variant = rows[0];
    if (!variant || !isProductVisibleInCatalog(variant, allowedGalleryIds)) {
      return NextResponse.json({ error: "Variant unavailable." }, { status: 400 });
    }

    if (variant.editions_remaining !== null && variant.editions_remaining < quantity) {
      return NextResponse.json({ error: "sold_out" }, { status: 409 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://exhibition.margies.app";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity,
          price_data: {
            currency: "aud",
            unit_amount: variant.price_aud,
            product_data: {
              name: `${variant.product_title} - ${variant.variant_label}`,
            },
          },
        },
      ],
      customer_email,
      shipping_address_collection: {
        allowed_countries: ["AU"],
      },
      metadata: {
        variant_id,
        quantity: String(quantity),
        variant_ids: JSON.stringify([{ variant_id, quantity }]),
      },
      success_url: `${siteUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/shop`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
    }

    return NextResponse.json({ checkout_url: session.url });
  } catch (error) {
    console.error("Checkout session creation failed", error);
    return NextResponse.json({ error: "Could not create checkout session." }, { status: 500 });
  }
}
