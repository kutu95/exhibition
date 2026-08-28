import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../../lib/api-route-errors";
import {
  groupProductOrders,
  type ProductOrderItemRow,
  type ProductOrderRow,
  type ProductOrderVariantRow,
} from "../../../../../../lib/product-orders";
import { supabaseAdmin } from "../../../../../../lib/supabase/admin";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const { data: variants, error: variantsError } = await supabaseAdmin
      .from("product_variants")
      .select("id,variant_label,width_mm,height_mm")
      .eq("product_id", id);

    if (variantsError) {
      return NextResponse.json({ error: variantsError.message }, { status: 500 });
    }

    const variantRows = (variants ?? []) as ProductOrderVariantRow[];
    if (variantRows.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("id,order_id,variant_id,quantity,unit_price_aud,edition_number_assigned,fulfilment_status")
      .in(
        "variant_id",
        variantRows.map((variant) => variant.id),
      );

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    const itemRows = (items ?? []) as ProductOrderItemRow[];
    const orderIds = [...new Set(itemRows.map((item) => item.order_id))];
    if (orderIds.length === 0) {
      return NextResponse.json({ orders: [] });
    }

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id,order_number,customer_name,customer_email,status,created_at,notes")
      .in("id", orderIds);

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    return NextResponse.json({
      orders: groupProductOrders({
        orders: (orders ?? []) as ProductOrderRow[],
        items: itemRows,
        variants: variantRows,
      }),
    });
  } catch (error) {
    return handleRouteError(error, "Admin product orders lookup failed");
  }
}
