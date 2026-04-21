import { NextResponse } from "next/server";
import Stripe from "stripe";

import { sendOrderConfirmationEmail } from "../../../../lib/emails/order-confirmation";
import { stripe } from "../../../../lib/stripe";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import type { Order } from "../../../../lib/supabase/types";

export const runtime = "nodejs";

type CheckoutMetadataItem = {
  variant_id: string;
  quantity: number;
};

type VariantForOrder = {
  id: string;
  variant_label: string;
  price_aud: number;
  edition_size: number | null;
  products: {
    title: string;
  } | null;
};

const parseCheckoutMetadata = (metadataValue: string | undefined): CheckoutMetadataItem[] => {
  if (!metadataValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(metadataValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is CheckoutMetadataItem => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const maybeItem = item as Record<string, unknown>;
      return (
        typeof maybeItem.variant_id === "string" &&
        typeof maybeItem.quantity === "number" &&
        Number.isInteger(maybeItem.quantity) &&
        maybeItem.quantity > 0
      );
    });
  } catch {
    return [];
  }
};

const upsertPaidOrderFromSession = async (
  session: Stripe.Checkout.Session,
  lineItems: Stripe.LineItem[],
) => {
  const metadataItems = parseCheckoutMetadata(session.metadata?.variant_ids);
  const variantIds = [...new Set(metadataItems.map((item) => item.variant_id))];

  if (variantIds.length === 0) {
    throw new Error("Stripe checkout session missing metadata variant_ids.");
  }

  if (lineItems.length === 0) {
    throw new Error("Stripe checkout session has no line items.");
  }

  const { data: variants, error: variantError } = await supabaseAdmin
    .from("product_variants")
    .select("id, variant_label, price_aud, edition_size, products(title)")
    .in("id", variantIds);

  if (variantError) {
    throw variantError;
  }

  const variantMap = new Map<string, VariantForOrder>(
    ((variants ?? []) as VariantForOrder[]).map((variant) => [variant.id, variant]),
  );

  if (variantMap.size !== variantIds.length) {
    throw new Error("Could not resolve all variants for order creation.");
  }

  const shippingAddress = session.customer_details
    ? {
        name: session.customer_details.name,
        email: session.customer_details.email,
        phone: session.customer_details.phone,
        address: session.customer_details.address,
      }
    : null;

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  const { data: existingOrder } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (existingOrder) {
    return;
  }

  const orderInsert = {
    stripe_payment_intent_id: paymentIntentId,
    stripe_checkout_session_id: session.id,
    status: "paid" as const,
    customer_email: session.customer_details?.email ?? session.customer_email ?? "",
    customer_name: session.customer_details?.name ?? null,
    shipping_address: shippingAddress,
    subtotal_aud: session.amount_subtotal ?? 0,
    shipping_aud: session.total_details?.amount_shipping ?? 0,
    total_aud: session.amount_total ?? 0,
    notes: null,
  };

  const { data: createdOrder, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert(orderInsert)
    .select("*")
    .single();

  if (orderError) {
    throw orderError;
  }

  const orderItemsInsert = metadataItems.map((item) => {
    const variant = variantMap.get(item.variant_id);
    if (!variant) {
      throw new Error("Variant missing while building order items.");
    }

    return {
      order_id: createdOrder.id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      unit_price_aud: variant.price_aud,
      edition_number_assigned: null as number | null,
    };
  });

  const { error: orderItemsError } = await supabaseAdmin
    .from("order_items")
    .insert(orderItemsInsert);

  if (orderItemsError) {
    throw orderItemsError;
  }

  const emailItems = metadataItems.map((item) => {
    const variant = variantMap.get(item.variant_id);
    if (!variant || !variant.products) {
      throw new Error("Variant missing while building confirmation email.");
    }

    return {
      title: variant.products.title,
      variant_label: variant.variant_label,
      quantity: item.quantity,
      unit_price_aud: variant.price_aud,
      edition_number_assigned: null as number | null,
      edition_size: variant.edition_size,
    };
  });

  await sendOrderConfirmationEmail({
    order: createdOrder as Order,
    items: emailItems,
  });
};

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing Stripe webhook config." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe signature verification failed", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ["line_items.data.price.product"],
        });
        const lineItems =
          expandedSession.line_items?.data ??
          (
            await stripe.checkout.sessions.listLineItems(session.id, {
              limit: 100,
              expand: ["data.price.product"],
            })
          ).data;

        await upsertPaidOrderFromSession(session, lineItems);
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;

        const { error } = await supabaseAdmin
          .from("orders")
          .update({ status: "cancelled" })
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .eq("status", "pending");

        if (error) {
          console.error("Failed to mark pending order as cancelled", error);
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("Stripe webhook internal error", error);
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
