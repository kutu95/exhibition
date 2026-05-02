import { NextResponse } from "next/server";
import Stripe from "stripe";

import { assignEditionsToOrder } from "../../../../lib/edition-assignment";
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
  products:
    | {
        title: string;
      }
    | Array<{
        title: string;
      }>
    | null;
};

type CreatedOrderItem = {
  id: string;
  variant_id: string;
  quantity: number;
  unit_price_aud: number;
  edition_number_assigned: number | null;
};

const extractProductTitle = (products: VariantForOrder["products"]): string | null => {
  if (!products) return null;
  const product = Array.isArray(products) ? products[0] ?? null : products;
  return product?.title ?? null;
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

const getCheckoutMetadataItems = (metadata: Stripe.Metadata | null): CheckoutMetadataItem[] => {
  const multiItemMetadata = parseCheckoutMetadata(metadata?.variant_ids);
  if (multiItemMetadata.length > 0) {
    return multiItemMetadata;
  }

  const quantity = Number(metadata?.quantity);
  if (
    metadata?.variant_id &&
    Number.isInteger(quantity) &&
    quantity > 0
  ) {
    return [{ variant_id: metadata.variant_id, quantity }];
  }

  return [];
};

const getFlattenedShippingAddress = (session: Stripe.Checkout.Session) => {
  const address = session.customer_details?.address;

  if (!address) {
    return null;
  }

  return {
    street: address.line1 ?? "",
    suburb: address.city ?? "",
    state: address.state ?? "",
    postcode: address.postal_code ?? "",
  };
};

const upsertPaidOrderFromSession = async (
  session: Stripe.Checkout.Session,
  lineItems: Stripe.LineItem[],
) => {
  const metadataItems = getCheckoutMetadataItems(session.metadata);
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

  const variantRows = (variants ?? []) as unknown as VariantForOrder[];
  const variantMap = new Map<string, VariantForOrder>(
    variantRows.map((variant) => [variant.id, variant]),
  );

  if (variantMap.size !== variantIds.length) {
    throw new Error("Could not resolve all variants for order creation.");
  }

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
    shipping_address: getFlattenedShippingAddress(session),
    subtotal_aud: session.amount_subtotal ?? 0,
    shipping_aud: 0,
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
      fulfilment_status: "awaiting_file" as const,
    };
  });

  const { data: createdItems, error: orderItemsError } = await supabaseAdmin
    .from("order_items")
    .insert(orderItemsInsert)
    .select("id,variant_id,quantity,unit_price_aud,edition_number_assigned");

  if (orderItemsError) {
    throw orderItemsError;
  }

  await assignEditionsToOrder(createdOrder.id);

  const itemRows = ((createdItems ?? []) as CreatedOrderItem[]);
  const { data: assignedItems, error: assignedItemsError } = await supabaseAdmin
    .from("order_items")
    .select("id,variant_id,quantity,unit_price_aud,edition_number_assigned")
    .in("id", itemRows.length ? itemRows.map((item) => item.id) : ["00000000-0000-0000-0000-000000000000"]);

  if (assignedItemsError) {
    throw assignedItemsError;
  }

  const emailItems = ((assignedItems ?? []) as CreatedOrderItem[]).map((item) => {
    const variant = variantMap.get(item.variant_id);
    const productTitle = variant ? extractProductTitle(variant.products) : null;
    if (!variant || !productTitle) {
      throw new Error("Variant missing while building confirmation email.");
    }

    return {
      title: productTitle,
      variant_label: variant.variant_label,
      quantity: item.quantity,
      unit_price_aud: item.unit_price_aud,
      edition_number_assigned: item.edition_number_assigned,
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
          .in("status", ["pending", "paid"]);

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
