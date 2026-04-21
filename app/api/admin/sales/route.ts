import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

const revenueStatuses = new Set(["paid", "processing", "shipped", "delivered"]);

const getWeekStart = (isoDate: string): string => {
  const date = new Date(isoDate);
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
};

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("id,status,total_aud,created_at")
    .order("created_at", { ascending: false });

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  const paidLikeOrders = (orders ?? []).filter((order) => revenueStatuses.has(order.status));
  const paidLikeOrderIds = paidLikeOrders.map((order) => order.id);

  const { data: orderItems, error: orderItemsError } = await supabaseAdmin
    .from("order_items")
    .select("order_id,variant_id,quantity,unit_price_aud")
    .in("order_id", paidLikeOrderIds.length ? paidLikeOrderIds : ["00000000-0000-0000-0000-000000000000"]);

  if (orderItemsError) {
    return NextResponse.json({ error: orderItemsError.message }, { status: 500 });
  }

  const variantIds = [...new Set((orderItems ?? []).map((item) => item.variant_id))];
  const variantMap = new Map<
    string,
    {
      variant_label: string;
      product_title: string;
    }
  >();

  if (variantIds.length > 0) {
    const { data: variants, error: variantsError } = await supabaseAdmin
      .from("product_variants")
      .select("id,variant_label,products(title)")
      .in("id", variantIds);

    if (variantsError) {
      return NextResponse.json({ error: variantsError.message }, { status: 500 });
    }

    (variants ?? []).forEach((variant) => {
      const product = Array.isArray(variant.products) ? variant.products[0] : variant.products;
      variantMap.set(variant.id, {
        variant_label: variant.variant_label,
        product_title: product?.title ?? "Unknown product",
      });
    });
  }

  const totalRevenue = paidLikeOrders.reduce((sum, order) => sum + (order.total_aud ?? 0), 0);
  const totalOrders = paidLikeOrders.length;
  const totalUnits = (orderItems ?? []).reduce((sum, item) => sum + item.quantity, 0);
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const revenueByProductMap = new Map<
    string,
    {
      product_title: string;
      variant_label: string;
      units_sold: number;
      revenue_aud: number;
    }
  >();

  (orderItems ?? []).forEach((item) => {
    const variant = variantMap.get(item.variant_id);
    if (!variant) return;
    const key = item.variant_id;
    const current = revenueByProductMap.get(key) ?? {
      product_title: variant.product_title,
      variant_label: variant.variant_label,
      units_sold: 0,
      revenue_aud: 0,
    };

    current.units_sold += item.quantity;
    current.revenue_aud += item.quantity * item.unit_price_aud;
    revenueByProductMap.set(key, current);
  });

  const statusBreakdownMap = new Map<string, number>();
  (orders ?? []).forEach((order) => {
    statusBreakdownMap.set(order.status, (statusBreakdownMap.get(order.status) ?? 0) + 1);
  });

  const weekRevenueMap = new Map<string, number>();
  paidLikeOrders.forEach((order) => {
    const weekStart = getWeekStart(order.created_at);
    weekRevenueMap.set(weekStart, (weekRevenueMap.get(weekStart) ?? 0) + (order.total_aud ?? 0));
  });

  return NextResponse.json({
    metrics: {
      total_revenue_aud: totalRevenue,
      average_order_value_aud: avgOrderValue,
      total_units_sold: totalUnits,
      total_orders: totalOrders,
    },
    revenue_by_product: [...revenueByProductMap.values()].sort((a, b) => b.revenue_aud - a.revenue_aud),
    status_breakdown: [...statusBreakdownMap.entries()].map(([status, count]) => ({ status, count })),
    revenue_by_week: [...weekRevenueMap.entries()]
      .map(([week_start, revenue_aud]) => ({ week_start, revenue_aud }))
      .sort((a, b) => a.week_start.localeCompare(b.week_start)),
  });
}
