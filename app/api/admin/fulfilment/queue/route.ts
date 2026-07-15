import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { getFulfilmentQueue } from "../../../../../lib/fulfilment-items";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await getFulfilmentQueue();

    return NextResponse.json({
      items: items.map(({ events: _events, ...item }) => item),
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error, "Admin fulfilment queue failed");
  }
}
