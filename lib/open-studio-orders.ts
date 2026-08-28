import { isStudioOrderNotes, STUDIO_ORDER_MARKER, type OpenStudioOrder } from "./studio-orders";
import { queryPostgres, withTransaction } from "./postgres";

/** Still assembling the lab batch — new prints may be added. */
const OPEN_FOR_ADD_STATUSES = ["awaiting_file", "file_ready"];
/** Already sent to Pixel Perfect (or beyond) — do not add more prints. */
const SUBMITTED_FULFILMENT_STATUSES = ["submitted_to_lab", "shipped", "delivered"];

type StudioOrderRow = {
  id: string;
  order_number: string;
  status: string;
  notes: string | null;
};

type StudioItemRow = {
  id: string;
  order_id: string;
  order_number: string;
  order_status: string;
  notes: string | null;
};

export const listOpenStudioOrders = async (): Promise<OpenStudioOrder[]> => {
  const { rows } = await queryPostgres<OpenStudioOrder>(
    `
      select
        o.id as order_id,
        o.order_number,
        o.created_at::text as created_at,
        sum(coalesce(oi.quantity, 1))::int as print_count
      from exhibition.orders o
      join exhibition.order_items oi on oi.order_id = o.id
      where o.notes like '%' || $1 || '%'
        and o.status not in ('cancelled', 'refunded')
      group by o.id, o.order_number, o.created_at
      having count(*) filter (
        where oi.fulfilment_status = any($2::text[])
      ) > 0
        and count(*) filter (
          where oi.fulfilment_status = any($3::text[])
        ) = 0
      order by o.created_at desc
    `,
    [STUDIO_ORDER_MARKER, OPEN_FOR_ADD_STATUSES, SUBMITTED_FULFILMENT_STATUSES],
  );

  return rows;
};

const getStudioOrder = async (orderId: string): Promise<StudioOrderRow | null> => {
  const { rows } = await queryPostgres<StudioOrderRow>(
    `
      select id, order_number, status, notes
      from exhibition.orders
      where id = $1
      limit 1
    `,
    [orderId],
  );
  return rows[0] ?? null;
};

export const requireOpenStudioOrder = async (orderId: string): Promise<StudioOrderRow> => {
  const order = await getStudioOrder(orderId);
  if (!order) {
    throw new Error("STUDIO_ORDER_NOT_FOUND");
  }
  if (!isStudioOrderNotes(order.notes)) {
    throw new Error("NOT_A_STUDIO_ORDER");
  }
  if (order.status === "cancelled" || order.status === "refunded") {
    throw new Error("STUDIO_ORDER_CLOSED");
  }

  const { rows: itemStatuses } = await queryPostgres<{ fulfilment_status: string }>(
    `
      select fulfilment_status
      from exhibition.order_items
      where order_id = $1
    `,
    [orderId],
  );
  if (itemStatuses.some((row) => SUBMITTED_FULFILMENT_STATUSES.includes(row.fulfilment_status))) {
    throw new Error("STUDIO_ORDER_SUBMITTED");
  }

  return order;
};

export const moveStudioOrderItems = async (
  orderItemIds: string[],
  targetOrderId: string,
): Promise<{ moved: number; cancelled_order_numbers: string[]; target_order_number: string }> => {
  const uniqueIds = [...new Set(orderItemIds)];
  if (uniqueIds.length === 0) {
    throw new Error("NO_ITEMS");
  }

  const target = await requireOpenStudioOrder(targetOrderId);

  return withTransaction(async (client) => {
    const { rows: items } = await client.query<StudioItemRow>(
      `
        select
          oi.id,
          oi.order_id,
          o.order_number,
          o.status as order_status,
          o.notes
        from exhibition.order_items oi
        join exhibition.orders o on o.id = oi.order_id
        where oi.id = any($1::uuid[])
      `,
      [uniqueIds],
    );

    if (items.length !== uniqueIds.length) {
      throw new Error("ORDER_ITEM_NOT_FOUND");
    }

    const nonStudio = items.find((item) => !isStudioOrderNotes(item.notes));
    if (nonStudio) {
      throw new Error("NOT_A_STUDIO_ITEM");
    }

    const sourceOrderIds = [...new Set(items.map((item) => item.order_id))].filter(
      (orderId) => orderId !== targetOrderId,
    );
    const toMove = items.filter((item) => item.order_id !== targetOrderId);

    if (toMove.length > 0) {
      await client.query(
        `
          update exhibition.order_items
          set order_id = $1
          where id = any($2::uuid[])
        `,
        [targetOrderId, toMove.map((item) => item.id)],
      );

      await client.query(
        `
          insert into exhibition.fulfilment_events (order_item_id, event_type, notes)
          select unnest($1::uuid[]), 'moved_to_order', $2
        `,
        [toMove.map((item) => item.id), `Moved to ${target.order_number}`],
      );
    }

    const cancelled: string[] = [];
    if (sourceOrderIds.length > 0) {
      const { rows: emptied } = await client.query<{ order_number: string }>(
        `
          update exhibition.orders
          set status = 'cancelled'
          where id = any($1::uuid[])
            and not exists (
              select 1
              from exhibition.order_items oi
              where oi.order_id = exhibition.orders.id
            )
          returning order_number
        `,
        [sourceOrderIds],
      );
      cancelled.push(...emptied.map((row) => row.order_number));
    }

    return {
      moved: toMove.length,
      cancelled_order_numbers: cancelled,
      target_order_number: target.order_number,
    };
  });
};
