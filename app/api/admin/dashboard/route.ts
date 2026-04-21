import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

const paidLikeStatuses = ["paid", "processing", "shipped", "delivered"] as const;

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
  }>;
};

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: revenueRows, error: revenueError } = await supabaseAdmin
    .from("orders")
    .select("total_aud,status")
    .in("status", [...paidLikeStatuses]);

  if (revenueError) {
    return NextResponse.json({ error: revenueError.message }, { status: 500 });
  }

  const revenueAudCents = (revenueRows ?? []).reduce(
    (sum, row) => sum + (row.total_aud ?? 0),
    0,
  );

  const [{ count: totalOrders, error: totalOrdersError }, { count: pendingDespatch, error: pendingError }] =
    await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", [...paidLikeStatuses]),
      supabaseAdmin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["paid", "processing"]),
    ]);

  if (totalOrdersError || pendingError) {
    return NextResponse.json(
      { error: totalOrdersError?.message ?? pendingError?.message ?? "Failed to query counts." },
      { status: 500 },
    );
  }

  const { count: subscribers, error: subscribersError } = await supabaseAdmin
    .from("email_subscribers")
    .select("id", { count: "exact", head: true });

  if (subscribersError) {
    return NextResponse.json({ error: subscribersError.message }, { status: 500 });
  }

  const { data: recentOrders, error: recentOrdersError } = await supabaseAdmin
    .from("orders")
    .select("id,order_number,customer_name,status,total_aud,created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  if (recentOrdersError) {
    return NextResponse.json({ error: recentOrdersError.message }, { status: 500 });
  }

  const payload: DashboardResponse = {
    totals: {
      totalOrders: totalOrders ?? 0,
      revenueAudCents,
      pendingDespatch: pendingDespatch ?? 0,
      subscribers: subscribers ?? 0,
    },
    recentOrders: recentOrders ?? [],
  };

  return NextResponse.json(payload);
}
