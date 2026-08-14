import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { handleRouteError } from "../../../../lib/api-route-errors";
import { isRevenueOrder, isStudioOrderNotes } from "../../../../lib/studio-orders";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

type DashboardResponse = {
  totals: {
    totalOrders: number;
    revenueAudCents: number;
    pendingDespatch: number;
    subscribers: number;
  };
  recentOrders: Array<{
    id: string;
    order_number: string;
    customer_name: string | null;
    status: string;
    total_aud: number | null;
    created_at: string;
    is_studio: boolean;
  }>;
};

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: orderRows, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id,order_number,customer_name,status,total_aud,created_at,notes")
      .order("created_at", { ascending: false });

    if (ordersError) {
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    const allOrders = orderRows ?? [];
    const revenueOrders = allOrders.filter((order) => isRevenueOrder(order));
    const pendingDespatch = allOrders.filter(
      (order) =>
        (order.status === "paid" || order.status === "processing") && !isStudioOrderNotes(order.notes),
    ).length;
    const revenueAudCents = revenueOrders.reduce((sum, row) => sum + (row.total_aud ?? 0), 0);

    const { count: subscribers, error: subscribersError } = await supabaseAdmin
      .from("email_subscribers")
      .select("id", { count: "exact", head: true });

    if (subscribersError) {
      return NextResponse.json({ error: subscribersError.message }, { status: 500 });
    }

    const payload: DashboardResponse = {
      totals: {
        totalOrders: revenueOrders.length,
        revenueAudCents,
        pendingDespatch,
        subscribers: subscribers ?? 0,
      },
      recentOrders: allOrders.slice(0, 10).map((order) => ({
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        status: order.status,
        total_aud: order.total_aud,
        created_at: order.created_at,
        is_studio: isStudioOrderNotes(order.notes),
      })),
    };

    return NextResponse.json(payload);
  } catch (error) {
    return handleRouteError(error, "Admin dashboard query failed");
  }
}
