import { z } from "zod";

import { getFulfilmentItem, type FulfilmentItem } from "./fulfilment-items";
import { withTransaction } from "./postgres";

export const fulfilmentStatusSchema = z.enum([
  "awaiting_file",
  "file_ready",
  "submitted_to_lab",
  "shipped",
  "delivered",
]);

export const fulfilmentUpdateSchema = z
  .object({
    fulfilment_status: fulfilmentStatusSchema.optional(),
    cloud_file_url: z.string().url().nullable().optional(),
    cloud_folder_path: z.string().nullable().optional(),
    pixel_perfect_order_ref: z.string().nullable().optional(),
    tracking_number: z.string().nullable().optional(),
    fulfilment_notes: z.string().nullable().optional(),
  })
  .strict();

export type FulfilmentUpdatePayload = z.infer<typeof fulfilmentUpdateSchema>;

const timestampColumnByStatus: Partial<Record<z.infer<typeof fulfilmentStatusSchema>, string>> = {
  file_ready: "file_ready_at",
  submitted_to_lab: "submitted_to_lab_at",
  shipped: "shipped_at",
};

export const updateFulfilmentItem = async (
  orderItemId: string,
  payload: FulfilmentUpdatePayload,
): Promise<FulfilmentItem | null> => {
  const updateEntries = Object.entries(payload).filter(([, value]) => value !== undefined);

  if (updateEntries.length === 0) {
    throw new Error("NO_UPDATE_FIELDS");
  }

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

    values.push(orderItemId);

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
      [orderItemId, updatedRow.fulfilment_status, payload.fulfilment_notes ?? null],
    );

    return updatedRow.fulfilment_status;
  });

  const item = await getFulfilmentItem(orderItemId);
  return item ? { ...item, fulfilment_status: updatedStatus } : null;
};
