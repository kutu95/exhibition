import { NextResponse } from "next/server";

import { assignEditionsToOrder } from "../../../../../lib/edition-assignment";
import { verifyBearerApiKey } from "../../../../../lib/api-key-auth";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ order_id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  if (!verifyBearerApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { order_id } = await context.params;

  try {
    const assigned_editions = await assignEditionsToOrder(order_id);
    return NextResponse.json({ order_id, assigned_editions });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_NOT_FOUND_OR_EMPTY") {
      return NextResponse.json({ error: "Order not found or has no items." }, { status: 404 });
    }

    if (error instanceof Error && error.message === "EDITION_SOLD_OUT") {
      return NextResponse.json({ error: "One or more variants are sold out." }, { status: 409 });
    }

    console.error("Edition assignment failed", error);
    return NextResponse.json({ error: "Failed to assign editions." }, { status: 500 });
  }
}
