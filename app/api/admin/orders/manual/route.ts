import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { assignEditionsToOrder } from "../../../../../lib/edition-assignment";
import { sendOrderConfirmationEmail } from "../../../../../lib/emails/order-confirmation";
import { MIXED_PROVIDER_MESSAGE, singleFulfilmentProvider } from "../../../../../lib/fulfilment";
import { resolveManualOrderLines } from "../../../../../lib/manual-order-items";
import { requireOpenStudioOrder } from "../../../../../lib/open-studio-orders";
import {
  STUDIO_CUSTOMER,
  STUDIO_FULFILMENT_NOTE,
  buildStudioOrderNotes,
} from "../../../../../lib/studio-orders";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import type { Order } from "../../../../../lib/supabase/types";

export const runtime = "nodejs";

const shippingAddressSchema = z.object({
  street: z.string().trim().max(200).optional(),
  suburb: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  postcode: z.string().trim().max(20).optional(),
  method: z.enum(["exhibition_pickup", "ship", "taken_today"]).optional(),
});

const lineItemSchema = z.object({
  variant_id: z.string().uuid(),
  quantity: z.coerce.number().int().positive().max(10).default(1),
  frame_colour: z.string().max(40).nullable().optional(),
});

const manualOrderSchema = z.object({
  mode: z.enum(["test", "on_site", "studio"]).default("test"),
  variant_id: z.string().uuid().optional(),
  quantity: z.coerce.number().int().positive().max(10).default(1),
  frame_colour: z.string().max(40).nullable().optional(),
  items: z.array(lineItemSchema).min(1).max(20).optional(),
  customer_email: z.string().email().optional(),
  customer_name: z.string().trim().max(120).optional(),
  allow_placeholder_customer: z.boolean().optional(),
  shipping_address: shippingAddressSchema.optional(),
  fulfilment: z.enum(["exhibition_pickup", "ship", "taken_today"]).optional(),
  payment_method: z.enum(["square", "cash", "manual"]).optional(),
  square_payment_id: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
  send_confirmation_email: z.boolean().optional(),
  existing_order_id: z.string().uuid().optional(),
});

type VariantRow = {
  id: string;
  variant_label: string;
  price_aud: number;
  is_active: boolean;
  edition_size: number | null;
  fulfilment_provider: "posterfactory" | "pixelperfect" | null;
  products:
    | {
        title: string;
        is_available: boolean;
        product_type: "print" | "merchandise";
      }
    | Array<{
        title: string;
        is_available: boolean;
        product_type: "print" | "merchandise";
      }>
    | null;
};

const getProduct = (products: VariantRow["products"]) => {
  if (!products) return null;
  return Array.isArray(products) ? products[0] ?? null : products;
};

const EXHIBITION_PICKUP = {
  street: "Studio pickup",
  suburb: "Margaret River",
  state: "WA",
  postcode: "6285",
  method: "exhibition_pickup" as const,
};

const TAKEN_TODAY = {
  street: "Taken at exhibition",
  suburb: "Margaret River",
  state: "WA",
  postcode: "6285",
  method: "taken_today" as const,
};

const normalizeAddress = (
  payload: z.infer<typeof manualOrderSchema>,
): Record<string, string> => {
  const fulfilment = payload.fulfilment ?? payload.shipping_address?.method ?? "exhibition_pickup";

  if (fulfilment === "taken_today") {
    return { ...TAKEN_TODAY };
  }

  if (fulfilment === "ship") {
    return {
      street: payload.shipping_address?.street?.trim() || "",
      suburb: payload.shipping_address?.suburb?.trim() || "",
      state: payload.shipping_address?.state?.trim() || "",
      postcode: payload.shipping_address?.postcode?.trim() || "",
      method: "ship",
    };
  }

  return {
    street: payload.shipping_address?.street?.trim() || EXHIBITION_PICKUP.street,
    suburb: payload.shipping_address?.suburb?.trim() || EXHIBITION_PICKUP.suburb,
    state: payload.shipping_address?.state?.trim() || EXHIBITION_PICKUP.state,
    postcode: payload.shipping_address?.postcode?.trim() || EXHIBITION_PICKUP.postcode,
    method: "exhibition_pickup",
  };
};

const paymentNote = (payload: z.infer<typeof manualOrderSchema>): string => {
  if (payload.mode === "studio") {
    return buildStudioOrderNotes(payload.notes);
  }

  const parts: string[] = [];
  if (payload.mode === "test") {
    parts.push("Fulfilment test order (no Stripe).");
  } else {
    parts.push("On-site sale.");
  }
  if (payload.payment_method) {
    parts.push(`payment=${payload.payment_method}`);
  }
  if (payload.square_payment_id) {
    parts.push(`square_payment_id=${payload.square_payment_id}`);
  }
  if (payload.notes?.trim()) {
    parts.push(payload.notes.trim());
  }
  return parts.join(" ");
};

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = manualOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? first.path.join(".") : "payload";
    return NextResponse.json(
      { error: first ? `${where}: ${first.message}` : "Invalid payload." },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const resolvedLines = resolveManualOrderLines(payload);
  if (!resolvedLines.ok) {
    return NextResponse.json({ error: resolvedLines.error }, { status: 400 });
  }
  const lines = resolvedLines.lines;

  const paymentMethod =
    payload.payment_method ??
    (payload.mode === "test" || payload.mode === "studio" ? "manual" : undefined);

  if (payload.mode === "on_site") {
    if (!paymentMethod) {
      return NextResponse.json({ error: "payment_method is required for on-site sales." }, { status: 400 });
    }
    if (paymentMethod === "square" && !payload.square_payment_id?.trim()) {
      return NextResponse.json(
        { error: "square_payment_id is required when payment_method is square." },
        { status: 400 },
      );
    }
    if (!payload.allow_placeholder_customer) {
      if (!payload.customer_email?.trim() || !payload.customer_name?.trim()) {
        return NextResponse.json(
          { error: "Customer name and email are required for on-site sales." },
          { status: 400 },
        );
      }
    }
    if (payload.fulfilment === "ship") {
      const address = normalizeAddress(payload);
      if (!address.street || !address.suburb || !address.state || !address.postcode) {
        return NextResponse.json(
          { error: "Full shipping address is required when fulfilment is ship." },
          { status: 400 },
        );
      }
    }
  }

  const variantIds = [...new Set(lines.map((line) => line.variant_id))];
  const { data: variants, error: variantError } = await supabaseAdmin
    .from("product_variants")
    .select(
      "id, variant_label, price_aud, is_active, edition_size, fulfilment_provider, products!inner(title, is_available, product_type)",
    )
    .in("id", variantIds);

  if (variantError) {
    console.error("Manual order variant lookup failed", variantError);
    return NextResponse.json({ error: "Could not load variants." }, { status: 500 });
  }

  const variantRows = (variants ?? []) as unknown as VariantRow[];
  const variantMap = new Map(variantRows.map((variant) => [variant.id, variant]));
  if (variantMap.size !== variantIds.length) {
    return NextResponse.json({ error: "Variant not found." }, { status: 404 });
  }

  const isStudio = payload.mode === "studio";

  for (const line of lines) {
    const variantRow = variantMap.get(line.variant_id);
    if (!variantRow) {
      return NextResponse.json({ error: "Variant not found." }, { status: 404 });
    }
    const product = getProduct(variantRow.products);
    if (!product) {
      return NextResponse.json({ error: "Variant is not currently available." }, { status: 400 });
    }
    if (product.product_type !== "print") {
      return NextResponse.json({ error: "Manual / on-site sales are only enabled for print variants." }, { status: 400 });
    }
    if (!isStudio && (!variantRow.is_active || !product.is_available)) {
      return NextResponse.json({ error: "Variant is not currently available." }, { status: 400 });
    }
  }

  const providerCheck = singleFulfilmentProvider(variantRows);
  if (!providerCheck.ok) {
    return NextResponse.json({ error: MIXED_PROVIDER_MESSAGE }, { status: 400 });
  }

  const customerEmail =
    payload.customer_email?.trim() ||
    (isStudio
      ? STUDIO_CUSTOMER.email
      : payload.mode === "test" || payload.allow_placeholder_customer
        ? "admin-test-order@exhibition.local"
        : "");
  const customerName =
    payload.customer_name?.trim() ||
    (isStudio
      ? STUDIO_CUSTOMER.name
      : payload.mode === "test" || payload.allow_placeholder_customer
        ? "Admin test order"
        : "");

  if (!customerEmail || !customerName) {
    return NextResponse.json({ error: "Customer name and email are required." }, { status: 400 });
  }

  const fulfilmentStatus =
    isStudio || payload.fulfilment !== "taken_today"
      ? ("awaiting_file" as const)
      : ("delivered" as const);

  const fulfilmentNotes = isStudio
    ? STUDIO_FULFILMENT_NOTE
    : payload.mode === "on_site"
      ? `On-site sale (${paymentMethod ?? "manual"}).`
      : "Created via admin fulfilment test (no Stripe).";

  const subtotal = lines.reduce((sum, line) => {
    const variantRow = variantMap.get(line.variant_id);
    const unitPrice = isStudio ? 0 : (variantRow?.price_aud ?? 0);
    return sum + unitPrice * line.quantity;
  }, 0);

  if (payload.existing_order_id) {
    if (!isStudio) {
      return NextResponse.json(
        { error: "Only studio prints can be added to an existing studio order." },
        { status: 400 },
      );
    }
    if (lines.length !== 1) {
      return NextResponse.json(
        { error: "Add one studio print at a time to an existing studio order." },
        { status: 400 },
      );
    }

    let existing;
    try {
      existing = await requireOpenStudioOrder(payload.existing_order_id);
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "STUDIO_ORDER_NOT_FOUND") {
        return NextResponse.json({ error: "Studio order not found." }, { status: 404 });
      }
      if (code === "NOT_A_STUDIO_ORDER") {
        return NextResponse.json({ error: "That order is not a studio order." }, { status: 400 });
      }
      if (code === "STUDIO_ORDER_CLOSED") {
        return NextResponse.json({ error: "That studio order is cancelled or refunded." }, { status: 400 });
      }
      if (code === "STUDIO_ORDER_SUBMITTED") {
        return NextResponse.json(
          { error: "That studio order has already been submitted to the lab." },
          { status: 400 },
        );
      }
      throw error;
    }

    // Studio batches are collected for one lab (Blue Wren). Older variants still
    // carry posterfactory vs pixelperfect labels; those must not block adding a print.

    const line = lines[0]!;
    const variantRow = variantMap.get(line.variant_id)!;

    const { data: createdItems, error: itemError } = await supabaseAdmin
      .from("order_items")
      .insert({
        order_id: existing.id,
        variant_id: line.variant_id,
        quantity: line.quantity,
        unit_price_aud: 0,
        edition_number_assigned: null,
        fulfilment_status: fulfilmentStatus,
        fulfilment_notes: fulfilmentNotes,
        fulfilment_provider: variantRow.fulfilment_provider,
        frame_colour: line.frame_colour,
      })
      .select("id, variant_id, quantity, unit_price_aud, edition_number_assigned");

    if (itemError || !createdItems?.[0]) {
      console.error("Studio order item add failed", itemError);
      return NextResponse.json({ error: "Could not add print to studio order." }, { status: 500 });
    }

    return NextResponse.json({
      order_id: existing.id,
      order_number: existing.order_number,
      status: "paid",
      fulfilment_status: fulfilmentStatus,
      total_aud: 0,
      is_studio: true,
      added_to_existing: true,
    });
  }

  const shippingAddress = normalizeAddress(payload);
  const squarePaymentId = payload.square_payment_id?.trim() || null;

  if (squarePaymentId) {
    const { data: existingSquare } = await supabaseAdmin
      .from("orders")
      .select("id, order_number")
      .eq("square_payment_id", squarePaymentId)
      .maybeSingle();
    if (existingSquare) {
      return NextResponse.json(
        {
          error: "An order already exists for this Square payment.",
          order_id: existingSquare.id,
          order_number: existingSquare.order_number,
        },
        { status: 409 },
      );
    }
  }

  const { data: createdOrder, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      stripe_payment_intent_id: null,
      stripe_checkout_session_id: null,
      square_payment_id: squarePaymentId,
      status: "paid",
      customer_email: customerEmail,
      customer_name: customerName,
      shipping_address: shippingAddress,
      subtotal_aud: subtotal,
      shipping_aud: 0,
      total_aud: subtotal,
      notes: paymentNote(payload),
      fulfilment_provider: providerCheck.provider,
    })
    .select("id, order_number, customer_email, customer_name, total_aud, subtotal_aud, shipping_aud, status, notes, created_at, updated_at, stripe_payment_intent_id, stripe_checkout_session_id, square_payment_id, shipping_address")
    .single();

  if (orderError || !createdOrder) {
    console.error("Manual order creation failed", orderError);
    return NextResponse.json({ error: "Could not create manual order." }, { status: 500 });
  }

  const orderItemsInsert = lines.map((line) => {
    const variantRow = variantMap.get(line.variant_id)!;
    return {
      order_id: createdOrder.id,
      variant_id: line.variant_id,
      quantity: line.quantity,
      unit_price_aud: isStudio ? 0 : variantRow.price_aud,
      edition_number_assigned: null as number | null,
      fulfilment_status: fulfilmentStatus,
      fulfilment_notes: fulfilmentNotes,
      fulfilment_provider: variantRow.fulfilment_provider,
      frame_colour: line.frame_colour,
    };
  });

  const { data: createdItems, error: itemError } = await supabaseAdmin
    .from("order_items")
    .insert(orderItemsInsert)
    .select("id, variant_id, quantity, unit_price_aud, edition_number_assigned");

  if (itemError || !createdItems?.[0]) {
    console.error("Manual order item creation failed", itemError);
    await supabaseAdmin.from("orders").delete().eq("id", createdOrder.id);
    return NextResponse.json({ error: "Could not create order item." }, { status: 500 });
  }

  if (!isStudio) {
    try {
      await assignEditionsToOrder(createdOrder.id);
    } catch (error) {
      console.error("Edition assignment failed for manual order", error);
      return NextResponse.json(
        {
          error: "Order created but edition assignment failed. Please review order manually.",
          order_id: createdOrder.id,
          order_number: createdOrder.order_number,
        },
        { status: 500 },
      );
    }
  }

  const shouldEmail =
    !isStudio &&
    (payload.send_confirmation_email === true ||
      (payload.mode === "on_site" &&
        !payload.allow_placeholder_customer &&
        !customerEmail.endsWith("@exhibition.local")));

  if (shouldEmail) {
    const { data: assignedItems } = await supabaseAdmin
      .from("order_items")
      .select("id, variant_id, quantity, unit_price_aud, edition_number_assigned")
      .eq("order_id", createdOrder.id);

    try {
      await sendOrderConfirmationEmail({
        order: createdOrder as Order,
        items: (assignedItems ?? []).map((item) => {
          const variantRow = variantMap.get(item.variant_id);
          const product = variantRow ? getProduct(variantRow.products) : null;
          return {
            title: product?.title ?? "Print",
            variant_label: variantRow?.variant_label ?? "",
            quantity: item.quantity,
            unit_price_aud: item.unit_price_aud,
            edition_number_assigned: item.edition_number_assigned,
            edition_size: variantRow?.edition_size ?? null,
          };
        }),
      });
    } catch (emailError) {
      console.error("On-site order confirmation email failed", emailError);
    }
  }

  return NextResponse.json({
    order_id: createdOrder.id,
    order_number: createdOrder.order_number,
    status: "paid",
    fulfilment_status: fulfilmentStatus,
    total_aud: subtotal,
    is_studio: isStudio,
  });
}
