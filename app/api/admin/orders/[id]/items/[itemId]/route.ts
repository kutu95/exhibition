import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../../../lib/admin-auth";
import { removeOrderItem, replaceOrderItemVariant } from "../../../../../../../lib/admin-order-item-variant";
import { handleRouteError } from "../../../../../../../lib/api-route-errors";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; itemId: string }>;
};

const patchSchema = z.object({
  variant_id: z.string().uuid(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, itemId } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A print option (variant) is required." }, { status: 400 });
  }

  try {
    const result = await replaceOrderItemVariant({
      orderId: id,
      itemId,
      variantId: parsed.data.variant_id,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ORDER_ITEM_NOT_FOUND" || code === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Order item not found." }, { status: 404 });
    }
    if (code === "VARIANT_NOT_FOUND") {
      return NextResponse.json({ error: "That print option was not found." }, { status: 404 });
    }
    if (code === "VARIANT_PRODUCT_MISMATCH") {
      return NextResponse.json(
        { error: "That option belongs to a different photograph." },
        { status: 400 },
      );
    }
    if (code === "ORDER_ITEM_NOT_EDITABLE") {
      return NextResponse.json(
        {
          error:
            "This print can only be edited while the order is pending, or a studio order still waiting for the lab.",
        },
        { status: 400 },
      );
    }
    return handleRouteError(error, "Admin order item variant update failed");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, itemId } = await context.params;

  try {
    const result = await removeOrderItem({
      orderId: id,
      itemId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ORDER_ITEM_NOT_FOUND" || code === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Order item not found." }, { status: 404 });
    }
    if (code === "ORDER_ITEM_NOT_EDITABLE") {
      return NextResponse.json(
        {
          error:
            "This print can only be removed while the order is pending, or a studio order still waiting for the lab.",
        },
        { status: 400 },
      );
    }
    return handleRouteError(error, "Admin order item remove failed");
  }
}
