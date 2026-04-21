"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { formatAUD } from "../../lib/utils/currency";
import { StatusBadge } from "./StatusBadge";
import styles from "./OrderDetailClient.module.css";

type OrderRecord = {
  id: string;
  order_number: string;
  status: string;
  customer_name: string | null;
  customer_email: string;
  shipping_address: Record<string, unknown> | null;
  subtotal_aud: number | null;
  shipping_aud: number;
  total_aud: number | null;
  notes: string | null;
};

type OrderItemRecord = {
  id: string;
  variant_id: string;
  quantity: number;
  unit_price_aud: number;
  edition_number_assigned: number | null;
  edition_size: number | null;
  product_title: string;
  variant_label: string;
};

type OrderDetailClientProps = {
  order: OrderRecord;
  items: OrderItemRecord[];
};

const statusOptions = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

export function OrderDetailClient({ order, items }: OrderDetailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState(order.status);
  const [notes, setNotes] = useState(order.notes ?? "");
  const [editionValues, setEditionValues] = useState<Record<string, string>>(
    Object.fromEntries(items.map((item) => [item.id, item.edition_number_assigned?.toString() ?? ""])),
  );

  const shippingLines = useMemo(() => {
    if (!order.shipping_address) return ["No shipping address provided."];
    const text = JSON.stringify(order.shipping_address, null, 2);
    return text.split("\n");
  }, [order.shipping_address]);

  const updateStatus = async () => {
    await fetch(`/api/admin/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  };

  const saveNotes = async () => {
    await fetch(`/api/admin/orders/${order.id}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    router.refresh();
  };

  const saveEdition = async (itemId: string) => {
    const value = Number.parseInt(editionValues[itemId] ?? "", 10);
    if (!Number.isFinite(value) || value <= 0) return;

    await fetch(`/api/admin/orders/${order.id}/items/${itemId}/edition`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edition_number: value }),
    });
    router.refresh();
  };

  return (
    <div className={styles.grid}>
      <section className={styles.panel}>
        <h1>{order.order_number}</h1>
        <StatusBadge status={order.status} />
        <div className={styles.inlineControls} style={{ marginTop: "0.9rem" }}>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button className={styles.button} type="button" onClick={updateStatus}>
            Update Status
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Customer</h2>
        <p>
          <strong>Name:</strong> {order.customer_name ?? "—"}
        </p>
        <p>
          <strong>Email:</strong> {order.customer_email}
        </p>
        <p>
          <strong>Shipping address:</strong>
        </p>
        <pre>{shippingLines.join("\n")}</pre>
      </section>

      <section className={styles.panel}>
        <h2>Items</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Edition</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product_title}</td>
                  <td>{item.variant_label}</td>
                  <td>{item.quantity}</td>
                  <td>{formatAUD(item.unit_price_aud)}</td>
                  <td>
                    {item.edition_size ? (
                      <div className={styles.inlineControls}>
                        <input
                          value={editionValues[item.id] ?? ""}
                          onChange={(event) =>
                            setEditionValues((prev) => ({
                              ...prev,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder="Edition #"
                          style={{ width: "90px" }}
                        />
                        <button className={styles.button} type="button" onClick={() => saveEdition(item.id)}>
                          Save
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Totals</h2>
        <p>Subtotal: {formatAUD(order.subtotal_aud ?? 0)}</p>
        <p>Shipping: {formatAUD(order.shipping_aud ?? 0)}</p>
        <p>
          <strong>Total: {formatAUD(order.total_aud ?? 0)}</strong>
        </p>
      </section>

      <section className={styles.panel}>
        <h2>Internal Notes</h2>
        <textarea className={styles.notes} value={notes} onChange={(event) => setNotes(event.target.value)} onBlur={saveNotes} />
        <div style={{ marginTop: "0.65rem" }}>
          <button className={styles.button} type="button" onClick={saveNotes}>
            Save Notes
          </button>
        </div>
      </section>
    </div>
  );
}
