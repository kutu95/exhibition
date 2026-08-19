import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { listOpenStudioOrders } from "../../../../../lib/open-studio-orders";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orders = await listOpenStudioOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    return handleRouteError(error, "Open studio orders list failed");
  }
}
