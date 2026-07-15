import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { assignEditionsToOrder } from "../../../../../lib/edition-assignment";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

export const runtime = "nodejs";

const manualOrderSchema = z.object({
  variant_id: z.string().uuid(),
  quantity: z.number().int().positive().max(10).default(1),
  customer_email: z.string().email().optional(),
  customer_name: z.string().trim().max(120).optional(),
  shipping_address: z
    .object({
      street: z.string().trim().max(200).optional(),
      suburb: z.string().trim().max(120).optional(),
      state: z.string().trim().max(120).optional(),
      postcode: z.string().trim().max(20).optional(),
    })
    .optional(),
  notes: z.string().trim().max(1000).optional(),
});

type VariantRow = {
  id: string;
  price_aud: number;
  is_active: boolean;
  products:
    | {
        is_available: boolean;
        product_type: "print" | "merchandise";
      }
    | Array<{
        is_available: boolean;
        product_type: "print" | "merchandise";
      }>
    | null;
};

const getProduct = (products: VariantRow["products"]) => {
  if (!products) return null;
  return Array.isArray(products) ? products[0] ?? null : products;
};

const normalizeAddress = (payload: z.infer<typeof manualOrderSchema>) => ({
  street: payload.shipping_address?.street?.trim() || "Studio pickup",
  suburb: payload.shipping_address?.suburb?.trim() || "Margaret River",
  state: payload.shipping_address?.state?.trim() || "WA",
  postcode: payload.shipping_address?.postcode?.trim() || "6285",
});

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = manualOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const payload = parsed.data;

  const { data: variant, error: variantError } = await supabaseAdmin
    .from("product_variants")
    .select("id, price_aud, is_active, products!inner(is_available, product_type)")
    .eq("id", payload.variant_id)
    .single();

  if (variantError || !variant) {
    return NextResponse.json({ error: "Variant not found." }, { status: 404 });
  }

  const variantRow = variant as unknown as VariantRow;
  const product = getProduct(variantRow.products);
  if (!product || !variantRow.is_active || !product.is_available) {
    return NextResponse.json({ error: "Variant is not currently available." }, { status: 400 });
  }

  if (product.product_type !== "print") {
    return NextResponse.json({ error: "Manual bypass is only enabled for print variants." }, { status: 400 });
  }

  const unitPrice = variantRow.price_aud;
  const subtotal = unitPrice * payload.quantity;
  const customerEmail = payload.customer_email?.trim() || "admin-test-order@exhibition.local";
  const customerName = payload.customer_name?.trim() || "Admin test order";
  const shippingAddress = normalizeAddress(payload);
  const adminNote = payload.notes?.trim() || "Admin test order created without Stripe payment.";

  const { data: createdOrder, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      stripe_payment_intent_id: null,
      stripe_checkout_session_id: null,
      status: "paid",
      customer_email: customerEmail,
      customer_name: customerName,
      shipping_address: shippingAddress,
      subtotal_aud: subtotal,
      shipping_aud: 0,
      total_aud: subtotal,
      notes: adminNote,
    })
    .select("id, order_number")
    .single();

  if (orderError || !createdOrder) {
    console.error("Manual order creation failed", orderError);
    return NextResponse.json({ error: "Could not create manual order." }, { status: 500 });
  }

  const { data: createdItems, error: itemError } = await supabaseAdmin
    .from("order_items")
    .insert({
      order_id: createdOrder.id,
      variant_id: payload.variant_id,
      quantity: payload.quantity,
      unit_price_aud: unitPrice,
      edition_number_assigned: null,
      fulfilment_status: "awaiting_file",
      fulfilment_notes: "Created via admin test bypass (no Stripe).",
    })
    .select("id");

  if (itemError || !createdItems?.[0]) {
    console.error("Manual order item creation failed", itemError);
    await supabaseAdmin.from("orders").delete().eq("id", createdOrder.id);
    return NextResponse.json({ error: "Could not create order item." }, { status: 500 });
  }

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

  return NextResponse.json({
    order_id: createdOrder.id,
    order_number: createdOrder.order_number,
    status: "paid",
    fulfilment_status: "awaiting_file",
  });
}
