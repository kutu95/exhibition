import { describe, expect, it } from "vitest";

import { groupProductOrders } from "../lib/product-orders";
import { buildStudioOrderNotes } from "../lib/studio-orders";

const variants = [
  { id: "v-a3", variant_label: "A3 Photographic", width_mm: 420, height_mm: 297 },
  { id: "v-a2", variant_label: "A2 Photographic", width_mm: 594, height_mm: 420 },
];

const orders = [
  {
    id: "o-1",
    order_number: "GEO-0001",
    customer_name: "Ada",
    customer_email: "ada@example.com",
    status: "paid",
    created_at: "2026-08-01T00:00:00.000Z",
    notes: null,
  },
  {
    id: "o-2",
    order_number: "GEO-0002",
    customer_name: null,
    customer_email: "studio@example.com",
    status: "processing",
    created_at: "2026-08-20T00:00:00.000Z",
    notes: buildStudioOrderNotes(),
  },
  {
    id: "o-3",
    order_number: "GEO-0003",
    customer_name: "Grace",
    customer_email: "grace@example.com",
    status: "paid",
    created_at: "2026-08-10T00:00:00.000Z",
    notes: null,
  },
];

const items = [
  {
    id: "i-1",
    order_id: "o-1",
    variant_id: "v-a2",
    quantity: 1,
    unit_price_aud: 45000,
    edition_number_assigned: 3,
    fulfilment_status: "shipped",
  },
  {
    id: "i-2",
    order_id: "o-1",
    variant_id: "v-a3",
    quantity: 2,
    unit_price_aud: 32000,
    edition_number_assigned: null,
    fulfilment_status: "awaiting_file",
  },
  {
    id: "i-3",
    order_id: "o-2",
    variant_id: "v-a3",
    quantity: 1,
    unit_price_aud: 0,
    edition_number_assigned: null,
    fulfilment_status: "file_ready",
  },
];

describe("product orders", () => {
  it("summarises each order containing the photograph, newest first", () => {
    const summaries = groupProductOrders({ orders, items, variants });

    expect(summaries.map((summary) => summary.order_number)).toEqual(["GEO-0002", "GEO-0001"]);

    const first = summaries[1];
    expect(first.print_count).toBe(3);
    expect(first.items.map((item) => item.variant_label)).toEqual(["A2 Photographic", "A3 Photographic"]);
    expect(first.items[0].width_mm).toBe(594);
    expect(first.is_studio).toBe(false);
  });

  it("flags studio orders and drops orders without a matching item", () => {
    const summaries = groupProductOrders({ orders, items, variants });

    expect(summaries.some((summary) => summary.order_number === "GEO-0003")).toBe(false);
    expect(summaries[0].is_studio).toBe(true);
  });

  it("hides cancelled orders", () => {
    const cancelled = {
      id: "o-4",
      order_number: "GEO-0004",
      customer_name: "Alan",
      customer_email: "alan@example.com",
      status: "cancelled",
      created_at: "2026-08-25T00:00:00.000Z",
      notes: null,
    };
    const cancelledItem = { ...items[0], id: "i-4", order_id: "o-4" };
    const summaries = groupProductOrders({
      orders: [...orders, cancelled],
      items: [...items, cancelledItem],
      variants,
    });

    expect(summaries.map((summary) => summary.order_number)).toEqual(["GEO-0002", "GEO-0001"]);
  });

  it("falls back to a placeholder label when the variant is missing", () => {
    const summaries = groupProductOrders({ orders, items, variants: [] });

    expect(summaries[0].items[0].variant_label).toBe("Unknown size");
  });
});
