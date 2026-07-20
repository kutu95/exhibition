import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";

import { assignEditionsToOrder } from "../../../lib/edition-assignment";
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

const isStripeBypassEnabled = (): boolean => {
  const value = process.env.CHECKOUT_BYPASS_STRIPE?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
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
      .select("id, variant_label, price_aud, products!inner(title, is_available)")
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

    if (isStripeBypassEnabled()) {
      const subtotal = requestedItems.reduce((sum, item) => {
        const variant = variantMap.get(item.variant_id);
        return sum + (variant ? variant.price_aud * item.quantity : 0);
      }, 0);

      const { data: createdOrder, error: orderError } = await supabaseAdmin
        .from("orders")
        .insert({
          stripe_payment_intent_id: null,
          stripe_checkout_session_id: null,
          status: "paid",
          customer_email: "stripe-bypass@exhibition.local",
          customer_name: "Stripe bypass test order",
          shipping_address: null,
          subtotal_aud: subtotal,
          shipping_aud: 0,
          total_aud: subtotal,
          notes: "Order created with CHECKOUT_BYPASS_STRIPE enabled.",
        })
        .select("id,order_number")
        .single();

      if (orderError || !createdOrder) {
        console.error("Bypass order creation failed", orderError);
        return NextResponse.json({ error: "Could not create bypass order." }, { status: 500 });
      }

      const orderItemsInsert = requestedItems.map((item) => {
        const variant = variantMap.get(item.variant_id);
        if (!variant) {
          throw new Error("Variant map mismatch.");
        }

        return {
          order_id: createdOrder.id,
          variant_id: item.variant_id,
          quantity: item.quantity,
          unit_price_aud: variant.price_aud,
          edition_number_assigned: null as number | null,
          fulfilment_status: "awaiting_file" as const,
          fulfilment_notes: "Created via global Stripe bypass setting.",
        };
      });

      const { error: itemError } = await supabaseAdmin
        .from("order_items")
        .insert(orderItemsInsert);

      if (itemError) {
        console.error("Bypass order item creation failed", itemError);
        await supabaseAdmin.from("orders").delete().eq("id", createdOrder.id);
        return NextResponse.json({ error: "Could not create bypass order items." }, { status: 500 });
      }

      await assignEditionsToOrder(createdOrder.id);

      return NextResponse.json({
        url: `${siteUrl}/order/success?manual_order=${encodeURIComponent(createdOrder.order_number)}`,
        bypass: true,
      });
    }

    const lineItems = requestedItems.map((item) => {
      const variant = variantMap.get(item.variant_id);
      const product = variant ? extractProduct(variant.products) : null;
      if (!variant || !product) {
        throw new Error("Variant map mismatch.");
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
