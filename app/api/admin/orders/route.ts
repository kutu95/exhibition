import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

type OrderListRow = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string;
  status: string;
  total_aud: number | null;
  created_at: string;
};

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("id,order_number,customer_name,customer_email,status,total_aud,created_at")
    .order("created_at", { ascending: false });

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  const orderRows = (orders ?? []) as OrderListRow[];
  const orderIds = orderRows.map((order) => order.id);

  const itemsCountMap = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("order_id")
      .in("order_id", orderIds);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    (items ?? []).forEach((item) => {
      const current = itemsCountMap.get(item.order_id) ?? 0;
      itemsCountMap.set(item.order_id, current + 1);
    });
  }

  return NextResponse.json(
    orderRows.map((order) => ({
      ...order,
      items_count: itemsCountMap.get(order.id) ?? 0,
    })),
  );
}
