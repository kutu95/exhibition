"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { formatAUD } from "../../lib/utils/currency";
import { formatLabDimensions } from "../../lib/print-size";
import { adminClientFetch, adminClientFetchError } from "../../lib/admin-client-fetch";
import { buildOrderItemEditQuery } from "../../lib/order-item-edit-params";
import { isStudioOrderNotes } from "../../lib/studio-orders";
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
  width_mm: number | null;
  height_mm: number | null;
  lab_cost_aud: number | null;
  product_slug: string | null;
  fulfilment_status?: string;
  image_url: string | null;
  image_alt: string | null;
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
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [itemActionError, setItemActionError] = useState<string | null>(null);

  const shippingLines = useMemo(() => {
    if (!order.shipping_address) return ["No shipping address provided."];
    const text = JSON.stringify(order.shipping_address, null, 2);
    return text.split("\n");
  }, [order.shipping_address]);

  const isStudio = isStudioOrderNotes(order.notes);
  const canEditItems =
    order.status !== "cancelled" &&
    order.status !== "refunded" &&
    (order.status === "pending" || isStudio);
  const labCostTotal = items.reduce(
    (sum, item) => sum + (item.lab_cost_aud ?? 0) * item.quantity,
    0,
  );

  const itemIsMutable = (item: OrderItemRecord): boolean => {
    if (!canEditItems) return false;
    const fulfilmentStatus = item.fulfilment_status ?? "awaiting_file";
    return fulfilmentStatus === "awaiting_file" || fulfilmentStatus === "file_ready";
  };

  const itemIsEditable = (item: OrderItemRecord): boolean =>
    itemIsMutable(item) && Boolean(item.product_slug);

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

  const removeItem = async (item: OrderItemRecord) => {
    const lastItem = items.length === 1;
    const confirmed = window.confirm(
      lastItem
        ? `Remove “${item.product_title}” from ${order.order_number}? This is the last print, so the order will be cancelled.`
        : `Remove “${item.product_title}” from ${order.order_number}?`,
    );
    if (!confirmed) return;

    setRemovingItemId(item.id);
    setItemActionError(null);
    try {
      const response = await adminClientFetch(`/api/admin/orders/${order.id}/items/${item.id}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 401) {
        setItemActionError("Admin session expired. Sign in at /admin/login, then try again.");
        return;
      }
      if (!response.ok) {
        setItemActionError(body?.error ?? "Could not remove this print.");
        return;
      }
      router.refresh();
    } catch (error) {
      setItemActionError(adminClientFetchError(error));
    } finally {
      setRemovingItemId(null);
    }
  };

  return (
    <div className={styles.grid}>
      <section className={styles.panel}>
        <h1>{order.order_number}</h1>
        <StatusBadge status={order.status} />
        {isStudio ? <StatusBadge status="studio" /> : null}
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
        {itemActionError ? <p className={styles.itemError}>{itemActionError}</p> : null}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.imageCol}>Image</th>
                <th>Product</th>
                <th>Variant</th>
                <th>Size</th>
                <th>Qty</th>
                {isStudio ? <th>Lab cost</th> : null}
                <th>Unit Price</th>
                <th>Edition</th>
                {canEditItems ? <th></th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className={styles.imageCol}>
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail of local or remote product image
                      <img
                        className={styles.thumb}
                        src={item.image_url}
                        alt={item.image_alt || item.product_title}
                      />
                    ) : (
                      <div className={styles.thumbPlaceholder} aria-hidden="true">
                        No image
                      </div>
                    )}
                  </td>
                  <td>{item.product_title}</td>
                  <td>{item.variant_label}</td>
                  <td>
                    {item.width_mm && item.height_mm && item.width_mm > 0 && item.height_mm > 0
                      ? formatLabDimensions(item.width_mm, item.height_mm)
                      : "—"}
                  </td>
                  <td>{item.quantity}</td>
                  {isStudio ? (
                    <td>
                      {item.lab_cost_aud != null && item.lab_cost_aud > 0
                        ? formatAUD(item.lab_cost_aud)
                        : "—"}
                    </td>
                  ) : null}
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
                  {canEditItems ? (
                    <td>
                      {itemIsMutable(item) ? (
                        <div className={styles.itemActions}>
                          {itemIsEditable(item) ? (
                            <Link
                              className={styles.button}
                              href={`/shop/${item.product_slug}?${buildOrderItemEditQuery(order.id, item.id, {
                                variant: item.variant_id,
                              })}`}
                            >
                              Edit
                            </Link>
                          ) : null}
                          <button
                            className={styles.buttonSecondary}
                            type="button"
                            disabled={removingItemId !== null}
                            onClick={() => void removeItem(item)}
                          >
                            {removingItemId === item.id ? "Removing…" : "Remove"}
                          </button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Totals</h2>
        {isStudio ? (
          <p>
            <strong>Lab cost: {labCostTotal > 0 ? formatAUD(labCostTotal) : "—"}</strong>
          </p>
        ) : null}
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
