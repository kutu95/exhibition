import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerApiKey } from "../../../../lib/api-key-auth";
import { sendFulfilmentNotificationEmail } from "../../../../lib/emails/fulfilment-notification";
import { getFulfilmentItem } from "../../../../lib/fulfilment-items";

export const runtime = "nodejs";

const notifySchema = z.object({
  order_item_id: z.string().uuid(),
  event_type: z.literal("shipped"),
});

export async function POST(request: Request) {
  if (!verifyBearerApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = notifySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification payload." }, { status: 400 });
  }

  const item = await getFulfilmentItem(parsed.data.order_item_id);
  if (!item) {
    return NextResponse.json({ error: "Order item not found." }, { status: 404 });
  }

  if (!item.tracking_number) {
    return NextResponse.json({ error: "Order item does not have a tracking number." }, { status: 400 });
  }

  try {
    await sendFulfilmentNotificationEmail({
      customer_email: item.customer_email,
      customer_name: item.customer_name,
      order_number: item.order_number,
      photo_title: item.photo_title,
      variant_label: item.variant_label,
      edition_number_assigned: item.edition_number_assigned,
      tracking_number: item.tracking_number,
    });

    return NextResponse.json({ ok: true, sent: true });
  } catch (error) {
    console.error("Fulfilment notification failed", error);
    return NextResponse.json({ error: "Failed to notify customer." }, { status: 500 });
  }
}
