import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { moveStudioOrderItems } from "../../../../../lib/open-studio-orders";

export const runtime = "nodejs";

const moveSchema = z.object({
  order_item_ids: z.array(z.string().uuid()).min(1),
  target_order_id: z.string().uuid(),
});

const moveErrorStatus: Record<string, number> = {
  NO_ITEMS: 400,
  STUDIO_ORDER_NOT_FOUND: 404,
  NOT_A_STUDIO_ORDER: 400,
  STUDIO_ORDER_CLOSED: 400,
  ORDER_ITEM_NOT_FOUND: 404,
  NOT_A_STUDIO_ITEM: 400,
};

const moveErrorMessage: Record<string, string> = {
  NO_ITEMS: "Select at least one print to move.",
  STUDIO_ORDER_NOT_FOUND: "Studio order not found.",
  NOT_A_STUDIO_ORDER: "Prints can only be moved onto a studio order.",
  STUDIO_ORDER_CLOSED: "That studio order is cancelled or refunded.",
  ORDER_ITEM_NOT_FOUND: "One of the selected prints was not found.",
  NOT_A_STUDIO_ITEM: "Only studio prints can be moved onto a studio order.",
};

export async function POST(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = moveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const result = await moveStudioOrderItems(parsed.data.order_item_ids, parsed.data.target_order_id);
    return NextResponse.json(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (moveErrorStatus[code]) {
      return NextResponse.json({ error: moveErrorMessage[code] }, { status: moveErrorStatus[code] });
    }
    return handleRouteError(error, "Moving studio prints failed");
  }
}
