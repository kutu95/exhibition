"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useCart } from "../CartProvider";
import type { CartItem } from "../../lib/cart";
import { describeVariantForBuyer } from "../../lib/print-offer";
import { formatAUD } from "../../lib/utils/currency";
import styles from "./OnSiteSaleClient.module.css";

const PENDING_SALE_KEY = "exhibition-onsite-pending-sale";

type FulfilmentMode = "exhibition_pickup" | "ship" | "taken_today";
type PaymentMethod = "square" | "cash" | "manual";

type PendingSaleItem = {
  variant_id: string;
  quantity: number;
  frame_colour?: string | null;
};

type PendingSale = {
  items: PendingSaleItem[];
  customer_email: string;
  customer_name: string;
  allow_placeholder_customer: boolean;
  fulfilment: FulfilmentMode;
  shipping_address: {
    street: string;
    suburb: string;
    state: string;
    postcode: string;
  };
  notes: string;
  client_transaction_id: string;
};

type OnSiteSaleClientProps = {
  squareConfigured: boolean;
};

const cartLinesForApi = (items: CartItem[]): PendingSaleItem[] =>
  items.map((item) => ({
    variant_id: item.variant_id,
    quantity: item.quantity,
    ...(item.frame_colour ? { frame_colour: item.frame_colour } : {}),
  }));

export function OnSiteSaleClient({ squareConfigured }: OnSiteSaleClientProps) {
  const router = useRouter();
  const { items, subtotalAud, clear } = useCart();

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [allowPlaceholder, setAllowPlaceholder] = useState(false);
  const [fulfilment, setFulfilment] = useState<FulfilmentMode>("exhibition_pickup");
  const [street, setStreet] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("WA");
  const [postcode, setPostcode] = useState("");
  const [notes, setNotes] = useState("");
  const [squarePaymentId, setSquarePaymentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const squareNote = useMemo(() => {
    if (items.length === 0) return "Exhibition on-site sale";
    const titles = items.map((item) => item.product_title);
    const unique = [...new Set(titles)];
    if (unique.length === 1) {
      return items.length === 1
        ? `${unique[0]} · ${items[0]?.variant_label ?? ""}`
        : `${unique[0]} × ${items.length}`;
    }
    return `On-site sale (${items.length} prints)`;
  }, [items]);

  const buildPayload = (paymentMethod: PaymentMethod, squareId?: string) => {
    if (items.length === 0) {
      throw new Error("Add prints from the shop first.");
    }
    return {
      mode: "on_site" as const,
      items: cartLinesForApi(items),
      customer_email: allowPlaceholder ? undefined : customerEmail.trim() || undefined,
      customer_name: allowPlaceholder ? undefined : customerName.trim() || undefined,
      allow_placeholder_customer: allowPlaceholder,
      fulfilment,
      shipping_address:
        fulfilment === "ship"
          ? { street, suburb, state, postcode, method: "ship" as const }
          : undefined,
      payment_method: paymentMethod,
      square_payment_id: squareId?.trim() || undefined,
      notes: notes.trim() || undefined,
      send_confirmation_email: !allowPlaceholder,
    };
  };

  const createOrder = async (paymentMethod: PaymentMethod, squareId?: string) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(paymentMethod, squareId)),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        order_number?: string;
        order_id?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not create order.");
      }
      clear();
      setSuccess(`Order ${body?.order_number ?? ""} created.`);
      if (body?.order_id) {
        router.push(`/admin/orders/${body.order_id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create order.");
    } finally {
      setBusy(false);
    }
  };

  const chargeWithSquare = async () => {
    if (items.length === 0) {
      setError("Add prints from the shop first.");
      return;
    }
    if (!squareConfigured) {
      setError("SQUARE_APPLICATION_ID is not configured. Use Mark paid after Square or Cash.");
      return;
    }
    if (!allowPlaceholder && (!customerName.trim() || !customerEmail.trim())) {
      setError("Customer name and email are required (or enable placeholder customer).");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    const clientTransactionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `onsite-${Date.now()}`;

    const pending: PendingSale = {
      items: cartLinesForApi(items),
      customer_email: customerEmail.trim(),
      customer_name: customerName.trim(),
      allow_placeholder_customer: allowPlaceholder,
      fulfilment,
      shipping_address: { street, suburb, state, postcode },
      notes: notes.trim(),
      client_transaction_id: clientTransactionId,
    };

    try {
      sessionStorage.setItem(PENDING_SALE_KEY, JSON.stringify(pending));
      const response = await fetch("/api/admin/on-site/square-charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount_cents: subtotalAud,
          note: squareNote,
          client_transaction_id: clientTransactionId,
        }),
      });
      const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !body?.url) {
        throw new Error(body?.error ?? "Could not start Square charge.");
      }
      window.location.href = body.url;
    } catch (err) {
      sessionStorage.removeItem(PENDING_SALE_KEY);
      setError(err instanceof Error ? err.message : "Could not start Square charge.");
      setBusy(false);
    }
  };

  const hasCart = items.length > 0;

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h1>On-site sale</h1>
          <p className={styles.muted}>
            Add prints in the shop (sizes, frames, custom sizing), then take Square, cash, or record a
            payment already taken.
          </p>
        </div>
        <div className={styles.headerLinks}>
          <Link className={styles.link} href="/shop">
            Shop
          </Link>
          <Link className={styles.link} href="/cart">
            Cart
          </Link>
          <Link className={styles.link} href="/admin/fulfilment">
            Fulfilment
          </Link>
        </div>
      </header>

      {!squareConfigured ? (
        <p className={styles.notice}>
          Square POS is not configured (`SQUARE_APPLICATION_ID`). You can still take cash or paste a
          Square receipt id after charging in the Square app.
        </p>
      ) : (
        <p className={styles.noticeOk}>
          Square reader ready — charge from this phone/tablet with the Square Point of Sale app
          installed and signed in.
        </p>
      )}

      <section className={styles.panel}>
        <h2>Cart</h2>
        {hasCart ? (
          <>
            <ul className={styles.cartList}>
              {items.map((item) => (
                <li key={`${item.variant_id}-${item.frame_colour ?? ""}`} className={styles.cartRow}>
                  <div className={styles.thumb}>
                    <Image
                      src={item.image_url}
                      alt={item.product_title}
                      fill
                      sizes="72px"
                      className={styles.thumbImage}
                    />
                  </div>
                  <div>
                    <p className={styles.cartTitle}>{item.product_title}</p>
                    <p className={styles.cartMeta}>
                      {describeVariantForBuyer({ variant_label: item.variant_label }, item.frame_colour) ??
                        item.variant_label}
                    </p>
                    <p className={styles.cartMeta}>
                      Qty {item.quantity} · {formatAUD(item.price_aud * item.quantity)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className={styles.total}>
              Total <strong>{formatAUD(subtotalAud)}</strong>
            </p>
            <p className={styles.muted}>
              <Link className={styles.link} href="/cart">
                Edit cart
              </Link>
              {" · "}
              <Link className={styles.link} href="/shop">
                Add another print
              </Link>
            </p>
          </>
        ) : (
          <p className={styles.muted}>
            The cart is empty.{" "}
            <Link className={styles.link} href="/shop">
              Add prints from the shop
            </Link>
            , including custom sizes, then return here to take payment.
          </p>
        )}
      </section>

      <section className={styles.panel}>
        <h2>Customer</h2>
        <label className={styles.field}>
          Name
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            disabled={allowPlaceholder}
            autoComplete="name"
          />
        </label>
        <label className={styles.field}>
          Email
          <input
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            disabled={allowPlaceholder}
            autoComplete="email"
          />
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={allowPlaceholder}
            onChange={(event) => setAllowPlaceholder(event.target.checked)}
          />
          Use placeholder customer (no confirmation email)
        </label>
      </section>

      <section className={styles.panel}>
        <h2>Fulfilment</h2>
        <div className={styles.radioRow}>
          {(
            [
              ["exhibition_pickup", "Exhibition pickup"],
              ["ship", "Ship later"],
              ["taken_today", "Taken today"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className={styles.check}>
              <input
                type="radio"
                name="fulfilment"
                checked={fulfilment === value}
                onChange={() => setFulfilment(value)}
              />
              {label}
            </label>
          ))}
        </div>
        {fulfilment === "ship" ? (
          <div className={styles.addressGrid}>
            <label className={styles.field}>
              Street
              <input value={street} onChange={(event) => setStreet(event.target.value)} />
            </label>
            <label className={styles.field}>
              Suburb
              <input value={suburb} onChange={(event) => setSuburb(event.target.value)} />
            </label>
            <label className={styles.field}>
              State
              <input value={state} onChange={(event) => setState(event.target.value)} />
            </label>
            <label className={styles.field}>
              Postcode
              <input value={postcode} onChange={(event) => setPostcode(event.target.value)} />
            </label>
          </div>
        ) : null}
        <label className={styles.field}>
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
        </label>
      </section>

      <section className={styles.panel}>
        <h2>Pay</h2>
        <div className={styles.actions}>
          <button
            className={styles.primary}
            type="button"
            disabled={busy || !hasCart}
            onClick={() => void chargeWithSquare()}
          >
            {busy ? "Working…" : "Charge with Square reader"}
          </button>
          <button
            className={styles.secondary}
            type="button"
            disabled={busy || !hasCart}
            onClick={() => void createOrder("cash")}
          >
            Record cash payment
          </button>
        </div>

        <div className={styles.markPaid}>
          <label className={styles.field}>
            Square receipt / transaction id
            <input
              value={squarePaymentId}
              onChange={(event) => setSquarePaymentId(event.target.value)}
              placeholder="Paste if POS callback failed"
            />
          </label>
          <button
            className={styles.secondary}
            type="button"
            disabled={busy || !hasCart || !squarePaymentId.trim()}
            onClick={() => void createOrder("square", squarePaymentId.trim())}
          >
            Mark paid after Square
          </button>
          <button
            className={styles.ghost}
            type="button"
            disabled={busy || !hasCart}
            onClick={() => void createOrder("manual")}
          >
            Already paid (manual note)
          </button>
        </div>
      </section>

      {error ? <p className={styles.error}>{error}</p> : null}
      {success ? <p className={styles.success}>{success}</p> : null}
    </div>
  );
}

export { PENDING_SALE_KEY };
export type { PendingSale, PendingSaleItem };
