"use client";

import { useEffect, useState } from "react";

import { adminClientFetch } from "../lib/admin-client-fetch";
import { formatStudioOrderOption, type OpenStudioOrder } from "../lib/studio-orders";
import styles from "./StudioOrderDestinationDialog.module.css";

const NEW_ORDER_VALUE = "";

/** Matches the ceiling on /api/admin/orders/manual. */
export const STUDIO_ORDER_MAX_QUANTITY = 10;

export const loadOpenStudioOrders = async (): Promise<OpenStudioOrder[]> => {
  const response = await adminClientFetch("/api/admin/orders/studio-open");
  if (!response.ok) {
    throw new Error("Could not load open studio orders.");
  }
  const body = (await response.json().catch(() => null)) as { orders?: OpenStudioOrder[] } | null;
  return body?.orders ?? [];
};

type StudioOrderDestinationDialogProps = {
  open: boolean;
  title: string;
  description: string;
  orders: OpenStudioOrder[];
  confirmLabel?: string;
  allowNew?: boolean;
  excludeOrderId?: string;
  askQuantity?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (orderId: string | null, quantity: number) => void;
};

export function StudioOrderDestinationDialog({
  open,
  title,
  description,
  orders,
  confirmLabel = "Continue",
  allowNew = true,
  excludeOrderId,
  askQuantity = false,
  busy = false,
  onCancel,
  onConfirm,
}: StudioOrderDestinationDialogProps) {
  const visibleOrders = orders.filter((order) => order.order_id !== excludeOrderId);
  const [selected, setSelected] = useState(NEW_ORDER_VALUE);
  const [quantity, setQuantity] = useState("1");

  useEffect(() => {
    if (!open) return;
    const first = visibleOrders[0];
    setSelected(first?.order_id ?? NEW_ORDER_VALUE);
    setQuantity("1");
  }, [open, excludeOrderId, orders]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, open, onCancel]);

  if (!open) return null;

  const parsedQuantity = Number.parseInt(quantity, 10);
  const clampedQuantity = Number.isNaN(parsedQuantity)
    ? 1
    : Math.min(Math.max(parsedQuantity, 1), STUDIO_ORDER_MAX_QUANTITY);
  const canConfirm = allowNew || Boolean(selected);

  return (
    <div className={styles.backdrop} role="presentation" onClick={() => { if (!busy) onCancel(); }}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-order-destination-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="studio-order-destination-title">{title}</h2>
        <p>{description}</p>
        <div className={styles.options}>
          {visibleOrders.map((order) => (
            <label key={order.order_id}>
              <input
                type="radio"
                name="studio-order-destination"
                value={order.order_id}
                checked={selected === order.order_id}
                disabled={busy}
                onChange={() => setSelected(order.order_id)}
              />
              <span>Add to {formatStudioOrderOption(order)}</span>
            </label>
          ))}
          {allowNew ? (
            <label>
              <input
                type="radio"
                name="studio-order-destination"
                value={NEW_ORDER_VALUE}
                checked={selected === NEW_ORDER_VALUE}
                disabled={busy}
                onChange={() => setSelected(NEW_ORDER_VALUE)}
              />
              <span>Start a new studio order</span>
            </label>
          ) : null}
          {!allowNew && visibleOrders.length === 0 ? (
            <p className={styles.empty}>No other open studio orders to move these prints onto.</p>
          ) : null}
        </div>
        {askQuantity ? (
          <label className={styles.quantity}>
            <span>Copies</span>
            <input
              type="number"
              min={1}
              max={STUDIO_ORDER_MAX_QUANTITY}
              step={1}
              value={quantity}
              disabled={busy}
              onChange={(event) => setQuantity(event.target.value)}
            />
            <span className={styles.quantityHint}>
              {clampedQuantity > 1
                ? `The lab prints ${clampedQuantity} copies from the one file.`
                : "One print."}
            </span>
          </label>
        ) : null}
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={busy || !canConfirm}
            onClick={() => onConfirm(selected || null, clampedQuantity)}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
