"use client";

import { useCallback, useEffect, useState } from "react";

import { formatAUD } from "../../lib/utils/currency";
import { formatDateTime } from "../../lib/utils/dates";
import type { ProductOrderSummary } from "../../lib/product-orders";
import { StatusBadge } from "./StatusBadge";
import styles from "./ProductOrdersButton.module.css";

type ProductOrdersButtonProps = {
  productId: string;
  productTitle: string;
};

const sizeLabel = (item: ProductOrderSummary["items"][number]): string => {
  if (!item.width_mm || !item.height_mm) return item.variant_label;
  return `${item.variant_label} · ${Math.round(item.width_mm)}×${Math.round(item.height_mm)}mm`;
};

export function ProductOrdersButton({ productId, productTitle }: ProductOrdersButtonProps) {
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<ProductOrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!open || orders || loading) return;

    let active = true;
    setLoading(true);
    setError(null);

    fetch(`/api/admin/products/${productId}/orders`)
      .then(async (response) => {
        const payload = (await response.json()) as { orders?: ProductOrderSummary[]; error?: string };
        if (!active) return;
        if (!response.ok) {
          setError(payload.error ?? "Could not load orders.");
          return;
        }
        setOrders(payload.orders ?? []);
      })
      .catch(() => {
        if (active) setError("Could not load orders.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [loading, open, orders, productId]);

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        aria-label={`Show orders containing ${productTitle}`}
        title="Orders containing this photograph"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.triggerIcon}>
          <path
            d="M6 3.75h12v16.5l-2.4-1.8-2.4 1.8-2.4-1.8-2.4 1.8L6 20.25V3.75z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M9 8.25h6M9 11.75h6M9 15.25h3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open ? (
        <div className={styles.backdrop} role="presentation" onClick={close}>
          <div
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`product-orders-title-${productId}`}
            onClick={(event) => event.stopPropagation()}
          >
            <header className={styles.header}>
              <div>
                <p className={styles.eyebrow}>Orders containing</p>
                <h2 id={`product-orders-title-${productId}`}>{productTitle}</h2>
              </div>
              <button type="button" className={styles.close} onClick={close} aria-label="Close">
                ×
              </button>
            </header>

            {loading ? <p className={styles.status}>Loading orders…</p> : null}
            {error ? <p className={styles.error}>{error}</p> : null}
            {orders && orders.length === 0 && !loading && !error ? (
              <p className={styles.status}>This photograph has not been ordered yet.</p>
            ) : null}

            {orders && orders.length > 0 ? (
              <ul className={styles.orderList}>
                {orders.map((order) => (
                  <li key={order.order_id}>
                    <a
                      className={styles.orderLink}
                      href={`/admin/orders/${order.order_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className={styles.orderTop}>
                        <strong>{order.order_number}</strong>
                        <span className={styles.badges}>
                          <StatusBadge status={order.status} />
                          {order.is_studio ? <StatusBadge status="studio" /> : null}
                        </span>
                      </span>
                      <span className={styles.orderMeta}>
                        {order.customer_name ?? order.customer_email} · {formatDateTime(order.created_at)}
                      </span>
                      <span className={styles.orderItems}>
                        {order.items.map((item) => (
                          <span key={item.order_item_id} className={styles.orderItem}>
                            {item.quantity} × {sizeLabel(item)} — {formatAUD(item.unit_price_aud)}
                            {item.edition_number_assigned ? ` · edition ${item.edition_number_assigned}` : ""}
                          </span>
                        ))}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
