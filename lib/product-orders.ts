import { isStudioOrderNotes } from "./studio-orders";

export type ProductOrderVariantRow = {
  id: string;
  variant_label: string | null;
  width_mm: number | null;
  height_mm: number | null;
};

export type ProductOrderItemRow = {
  id: string;
  order_id: string;
  variant_id: string;
  quantity: number | null;
  unit_price_aud: number | null;
  edition_number_assigned: number | null;
  fulfilment_status: string | null;
};

export type ProductOrderRow = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string;
  status: string;
  created_at: string;
  notes: string | null;
};

export type ProductOrderItem = {
  order_item_id: string;
  variant_label: string;
  width_mm: number | null;
  height_mm: number | null;
  quantity: number;
  unit_price_aud: number;
  edition_number_assigned: number | null;
  fulfilment_status: string | null;
};

export type ProductOrderSummary = {
  order_id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string;
  status: string;
  created_at: string;
  is_studio: boolean;
  print_count: number;
  items: ProductOrderItem[];
};

/**
 * Collapse order items for one photograph into a per-order summary, newest first.
 * Orders with no matching item are dropped.
 */
export const groupProductOrders = (args: {
  orders: ProductOrderRow[];
  items: ProductOrderItemRow[];
  variants: ProductOrderVariantRow[];
}): ProductOrderSummary[] => {
  const variantsById = new Map(args.variants.map((variant) => [variant.id, variant]));
  const itemsByOrder = new Map<string, ProductOrderItem[]>();

  args.items.forEach((item) => {
    const variant = variantsById.get(item.variant_id);
    const existing = itemsByOrder.get(item.order_id) ?? [];
    existing.push({
      order_item_id: item.id,
      variant_label: variant?.variant_label ?? "Unknown size",
      width_mm: variant?.width_mm ?? null,
      height_mm: variant?.height_mm ?? null,
      quantity: item.quantity ?? 1,
      unit_price_aud: item.unit_price_aud ?? 0,
      edition_number_assigned: item.edition_number_assigned,
      fulfilment_status: item.fulfilment_status,
    });
    itemsByOrder.set(item.order_id, existing);
  });

  return args.orders
    .flatMap((order) => {
      const items = itemsByOrder.get(order.id);
      if (!items || items.length === 0) return [];
      const sortedItems = [...items].sort((a, b) => a.variant_label.localeCompare(b.variant_label));
      return [
        {
          order_id: order.id,
          order_number: order.order_number,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          status: order.status,
          created_at: order.created_at,
          is_studio: isStudioOrderNotes(order.notes),
          print_count: sortedItems.reduce((total, item) => total + item.quantity, 0),
          items: sortedItems,
        },
      ];
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};
