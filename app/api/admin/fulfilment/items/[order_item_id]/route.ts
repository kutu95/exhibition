import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { fulfilmentUpdateSchema, updateFulfilmentItem } from "../../../../../../lib/fulfilment-update";
import { getFulfilmentItem } from "../../../../../../lib/fulfilment-items";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ order_item_id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { order_item_id } = await context.params;
  const item = await getFulfilmentItem(order_item_id);

  if (!item) {
    return NextResponse.json({ error: "Order item not found." }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { order_item_id } = await context.params;
  const parsed = fulfilmentUpdateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fulfilment update payload." }, { status: 400 });
  }

  try {
    const item = await updateFulfilmentItem(order_item_id, parsed.data);

    if (!item) {
      return NextResponse.json({ error: "Order item not found." }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    if (error instanceof Error && error.message === "NO_UPDATE_FIELDS") {
      return NextResponse.json({ error: "No update fields provided." }, { status: 400 });
    }

    if (error instanceof Error && error.message === "ORDER_ITEM_NOT_FOUND") {
      return NextResponse.json({ error: "Order item not found." }, { status: 404 });
    }

    console.error("Admin fulfilment item update failed", error);
    return NextResponse.json({ error: "Failed to update fulfilment item." }, { status: 500 });
  }
}
