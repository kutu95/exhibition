import { isStudioOrderNotes } from "./studio-orders";
import { withTransaction } from "./postgres";

const EDITABLE_ORDER_STATUSES = new Set(["pending", "paid", "processing"]);
const EDITABLE_FULFILMENT_STATUSES = new Set(["awaiting_file", "file_ready"]);

type ItemContext = {
  item_id: string;
  order_id: string;
  current_variant_id: string;
  quantity: number;
  fulfilment_status: string;
  order_status: string;
  order_notes: string | null;
  shipping_aud: number;
  current_product_id: string;
};

type VariantContext = {
  id: string;
  product_id: string;
  price_aud: number;
  is_active: boolean;
};

export type ReplaceOrderItemVariantResult = {
  order_id: string;
  order_number: string;
  variant_id: string;
};

export const replaceOrderItemVariant = async (args: {
  orderId: string;
  itemId: string;
  variantId: string;
}): Promise<ReplaceOrderItemVariantResult> => {
  return withTransaction(async (client) => {
    const { rows: itemRows } = await client.query<ItemContext>(
      `
        select
          oi.id as item_id,
          oi.order_id,
          oi.variant_id as current_variant_id,
          oi.quantity,
          oi.fulfilment_status,
          o.status as order_status,
          o.notes as order_notes,
          o.shipping_aud,
          pv.product_id as current_product_id
        from exhibition.order_items oi
        join exhibition.orders o on o.id = oi.order_id
        join exhibition.product_variants pv on pv.id = oi.variant_id
        where oi.id = $1
          and oi.order_id = $2
      `,
      [args.itemId, args.orderId],
    );

    const item = itemRows[0];
    if (!item) {
      throw new Error("ORDER_ITEM_NOT_FOUND");
    }

    if (!EDITABLE_ORDER_STATUSES.has(item.order_status)) {
      throw new Error("ORDER_ITEM_NOT_EDITABLE");
    }
    if (!EDITABLE_FULFILMENT_STATUSES.has(item.fulfilment_status)) {
      throw new Error("ORDER_ITEM_NOT_EDITABLE");
    }

    const isStudio = isStudioOrderNotes(item.order_notes);
    if (item.order_status !== "pending" && !isStudio) {
      throw new Error("ORDER_ITEM_NOT_EDITABLE");
    }

    const { rows: variantRows } = await client.query<VariantContext>(
      `
        select id, product_id, price_aud, is_active
        from exhibition.product_variants
        where id = $1
      `,
      [args.variantId],
    );
    const variant = variantRows[0];
    if (!variant) {
      throw new Error("VARIANT_NOT_FOUND");
    }
    if (variant.product_id !== item.current_product_id) {
      throw new Error("VARIANT_PRODUCT_MISMATCH");
    }

    const unitPrice = isStudio ? 0 : variant.price_aud;
    if (item.current_variant_id === variant.id) {
      const { rows: orderRows } = await client.query<{ id: string; order_number: string }>(
        `
          select id, order_number
          from exhibition.orders
          where id = $1
        `,
        [item.order_id],
      );
      const order = orderRows[0];
      if (!order) {
        throw new Error("ORDER_NOT_FOUND");
      }
      return {
        order_id: order.id,
        order_number: order.order_number,
        variant_id: variant.id,
      };
    }

    const resetFile = item.fulfilment_status !== "awaiting_file";

    await client.query(
      `
        update exhibition.order_items
        set
          variant_id = $2,
          unit_price_aud = $3,
          fulfilment_status = case when $4 then 'awaiting_file' else fulfilment_status end,
          cloud_file_url = case when $4 then null else cloud_file_url end,
          file_ready_at = case when $4 then null else file_ready_at end
        where id = $1
      `,
      [item.item_id, variant.id, unitPrice, resetFile],
    );

    await client.query(
      `
        insert into exhibition.fulfilment_events (order_item_id, event_type, notes)
        values ($1, 'variant_changed', $2)
      `,
      [item.item_id, `Variant changed to ${variant.id}`],
    );

    const { rows: totalRows } = await client.query<{ subtotal: number }>(
      `
        select coalesce(sum(unit_price_aud * quantity), 0)::int as subtotal
        from exhibition.order_items
        where order_id = $1
      `,
      [item.order_id],
    );
    const subtotal = totalRows[0]?.subtotal ?? 0;

    const { rows: orderRows } = await client.query<{ id: string; order_number: string }>(
      `
        update exhibition.orders
        set subtotal_aud = $2, total_aud = $2 + $3
        where id = $1
        returning id, order_number
      `,
      [item.order_id, subtotal, item.shipping_aud],
    );

    const order = orderRows[0];
    if (!order) {
      throw new Error("ORDER_NOT_FOUND");
    }

    return {
      order_id: order.id,
      order_number: order.order_number,
      variant_id: variant.id,
    };
  });
};
