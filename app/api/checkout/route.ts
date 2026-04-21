import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

import { stripe } from "../../../lib/stripe";
import { supabaseAdmin } from "../../../lib/supabase/admin";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        variant_id: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
});

type VariantRecord = {
  id: string;
  variant_label: string;
  price_aud: number;
  stripe_price_id: string | null;
  products:
    | {
        title: string;
        is_available: boolean;
      }
    | Array<{
        title: string;
        is_available: boolean;
      }>
    | null;
};

const extractProduct = (
  products: VariantRecord["products"],
): { title: string; is_available: boolean } | null => {
  if (!products) return null;
  return Array.isArray(products) ? products[0] ?? null : products;
};

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = checkoutSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid checkout payload." }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!siteUrl) {
      return NextResponse.json({ error: "Missing NEXT_PUBLIC_SITE_URL." }, { status: 500 });
    }

    const requestedItems = parsed.data.items;
    const variantIds = [...new Set(requestedItems.map((item) => item.variant_id))];

    const { data: variants, error: variantsError } = await supabaseAdmin
      .from("product_variants")
      .select("id, variant_label, price_aud, stripe_price_id, products!inner(title, is_available)")
      .in("id", variantIds)
      .eq("is_active", true)
      .eq("products.is_available", true);

    if (variantsError) {
      console.error("Variant lookup failed", variantsError);
      return NextResponse.json({ error: "Could not prepare checkout." }, { status: 500 });
    }

    const variantRows = (variants ?? []) as unknown as VariantRecord[];
    const variantMap = new Map<string, VariantRecord>(
      variantRows.map((variant) => [variant.id, variant]),
    );

    if (variantMap.size !== variantIds.length) {
      return NextResponse.json(
        { error: "One or more variants are unavailable." },
        { status: 400 },
      );
    }

    const lineItems = requestedItems.map((item) => {
      const variant = variantMap.get(item.variant_id);
      const product = variant ? extractProduct(variant.products) : null;
      if (!variant || !product) {
        throw new Error("Variant map mismatch.");
      }

      if (variant.stripe_price_id) {
        return {
          price: variant.stripe_price_id,
          quantity: item.quantity,
        };
      }

      return {
        quantity: item.quantity,
        price_data: {
          currency: "aud",
          unit_amount: variant.price_aud,
          product_data: {
            name: `${product.title} - ${variant.variant_label}`,
          },
        },
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${siteUrl}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/shop`,
      shipping_address_collection: {
        allowed_countries: ["AU", "NZ", "GB", "US", "CA", "DE", "FR", "NL", "SG", "JP"],
      },
      metadata: {
        variant_ids: JSON.stringify(requestedItems),
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Failed to create checkout URL." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout route failed", error);
    return NextResponse.json({ error: "Could not create checkout session." }, { status: 500 });
  }
}
