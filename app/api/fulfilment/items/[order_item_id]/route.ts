import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyBearerApiKey } from "../../../../../lib/api-key-auth";
import { getFulfilmentItem } from "../../../../../lib/fulfilment-items";
import { withTransaction } from "../../../../../lib/postgres";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ order_item_id: string }>;
};

const fulfilmentStatusSchema = z.enum([
  "awaiting_file",
  "file_ready",
  "submitted_to_lab",
  "shipped",
  "delivered",
]);

const updateSchema = z
  .object({
    fulfilment_status: fulfilmentStatusSchema.optional(),
    cloud_file_url: z.string().url().nullable().optional(),
    cloud_folder_path: z.string().nullable().optional(),
    pixel_perfect_order_ref: z.string().nullable().optional(),
    tracking_number: z.string().nullable().optional(),
    fulfilment_notes: z.string().nullable().optional(),
  })
  .strict();

const timestampColumnByStatus: Partial<Record<z.infer<typeof fulfilmentStatusSchema>, string>> = {
  file_ready: "file_ready_at",
  submitted_to_lab: "submitted_to_lab_at",
  shipped: "shipped_at",
};

export async function GET(request: Request, context: RouteContext) {
  if (!verifyBearerApiKey(request)) {
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
  if (!verifyBearerApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { order_item_id } = await context.params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fulfilment update payload." }, { status: 400 });
  }

  const payload = parsed.data;
  const updateEntries = Object.entries(payload).filter(([, value]) => value !== undefined);

  if (updateEntries.length === 0) {
    return NextResponse.json({ error: "No update fields provided." }, { status: 400 });
  }

  try {
    const updatedStatus = await withTransaction(async (client) => {
      const setClauses: string[] = [];
      const values: unknown[] = [];

      updateEntries.forEach(([field, value]) => {
        values.push(value);
        setClauses.push(`${field} = $${values.length}`);
      });

      if (payload.fulfilment_status) {
        const timestampColumn = timestampColumnByStatus[payload.fulfilment_status];
        if (timestampColumn) {
          setClauses.push(`${timestampColumn} = now()`);
        }
      }

      values.push(order_item_id);

      const { rows } = await client.query<{ fulfilment_status: string }>(
        `
          update exhibition.order_items
          set ${setClauses.join(", ")}
          where id = $${values.length}
          returning fulfilment_status
        `,
        values,
      );

      const updatedRow = rows[0];
      if (!updatedRow) {
        throw new Error("ORDER_ITEM_NOT_FOUND");
      }

      await client.query(
        `
          insert into exhibition.fulfilment_events (order_item_id, event_type, notes)
          values ($1, $2, $3)
        `,
        [order_item_id, updatedRow.fulfilment_status, payload.fulfilment_notes ?? null],
      );

      return updatedRow.fulfilment_status;
    });

    const item = await getFulfilmentItem(order_item_id);

    if (!item) {
      return NextResponse.json({ error: "Order item not found." }, { status: 404 });
    }

    return NextResponse.json({ ...item, fulfilment_status: updatedStatus });
  } catch (error) {
    if (error instanceof Error && error.message === "ORDER_ITEM_NOT_FOUND") {
      return NextResponse.json({ error: "Order item not found." }, { status: 404 });
    }

    console.error("Fulfilment item update failed", error);
    return NextResponse.json({ error: "Failed to update fulfilment item." }, { status: 500 });
  }
}
