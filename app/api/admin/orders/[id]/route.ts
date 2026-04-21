import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from("order_items")
    .select("id,order_id,variant_id,quantity,unit_price_aud,edition_number_assigned")
    .eq("order_id", id);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  const variantIds = (items ?? []).map((item) => item.variant_id);
  const variantsById = new Map<
    string,
    {
      variant_label: string;
      edition_size: number | null;
      product_title: string;
    }
  >();

  if (variantIds.length > 0) {
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from("product_variants")
      .select("id,variant_label,edition_size,products(title)")
      .in("id", variantIds);

    if (variantsError) {
      return NextResponse.json({ error: variantsError.message }, { status: 500 });
    }

    (variants ?? []).forEach((variant) => {
      const products = Array.isArray(variant.products) ? variant.products[0] : variant.products;
      variantsById.set(variant.id, {
        variant_label: variant.variant_label,
        edition_size: variant.edition_size,
        product_title: products?.title ?? "Unknown product",
      });
    });
  }

  const enrichedItems = (items ?? []).map((item) => {
    const variant = variantsById.get(item.variant_id);
    return {
      ...item,
      variant_label: variant?.variant_label ?? "Unknown variant",
      edition_size: variant?.edition_size ?? null,
      product_title: variant?.product_title ?? "Unknown product",
    };
  });

  return NextResponse.json({
    order,
    items: enrichedItems,
  });
}
