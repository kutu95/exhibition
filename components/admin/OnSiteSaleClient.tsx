"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { formatAUD } from "../../lib/utils/currency";
import styles from "./OnSiteSaleClient.module.css";

const PENDING_SALE_KEY = "exhibition-onsite-pending-sale";

type ProductListItem = {
  id: string;
  title: string;
  slug: string;
  is_available: boolean;
  product_type: string;
};

type VariantRow = {
  id: string;
  variant_label: string;
  price_aud: number;
  is_active: boolean;
};

type ProductDetail = {
  id: string;
  title: string;
  slug: string;
  product_variants: VariantRow[];
};

type FulfilmentMode = "exhibition_pickup" | "ship" | "taken_today";
type PaymentMethod = "square" | "cash" | "manual";

type PendingSale = {
  variant_id: string;
  quantity: number;
  product_title: string;
  variant_label: string;
  price_aud: number;
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

export function OnSiteSaleClient({ squareConfigured }: OnSiteSaleClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillProductId = searchParams.get("product") ?? "";
  const prefillVariantId = searchParams.get("variant") ?? "";

  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [productId, setProductId] = useState(prefillProductId);
  const [productDetail, setProductDetail] = useState<ProductDetail | null>(null);
  const [variantId, setVariantId] = useState(prefillVariantId);
  const [quantity, setQuantity] = useState(1);
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
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/admin/products");
        if (!response.ok) throw new Error("Failed to load products.");
        const data = (await response.json()) as ProductListItem[];
        setProducts(
          data.filter((product) => product.product_type === "print" && product.is_available),
        );
      } catch (err) {
        console.error(err);
        setLoadError("Could not load products.");
      }
    })();
  }, []);

  const loadProduct = useCallback(async (id: string) => {
    if (!id) {
      setProductDetail(null);
      return;
    }
    const response = await fetch(`/api/admin/products/${id}`);
    if (!response.ok) {
      throw new Error("Failed to load product detail.");
    }
    const data = (await response.json()) as ProductDetail;
    setProductDetail(data);
    const active = (data.product_variants ?? []).filter((variant) => variant.is_active);
    if (prefillVariantId && active.some((variant) => variant.id === prefillVariantId)) {
      setVariantId(prefillVariantId);
    } else if (active[0]) {
      setVariantId((current) =>
        current && active.some((variant) => variant.id === current) ? current : active[0].id,
      );
    }
  }, [prefillVariantId]);

  useEffect(() => {
    if (!productId) {
      setProductDetail(null);
      return;
    }
    void loadProduct(productId).catch((err) => {
      console.error(err);
      setError("Could not load product variants.");
    });
  }, [loadProduct, productId]);

  const selectedVariant = useMemo(
    () => productDetail?.product_variants.find((variant) => variant.id === variantId) ?? null,
    [productDetail, variantId],
  );

  const activeVariants = useMemo(
    () => (productDetail?.product_variants ?? []).filter((variant) => variant.is_active),
    [productDetail],
  );

  const totalAud = selectedVariant ? selectedVariant.price_aud * quantity : 0;

  const buildPayload = (paymentMethod: PaymentMethod, squareId?: string) => {
    if (!selectedVariant || !productDetail) {
      throw new Error("Select a product and variant.");
    }
    return {
      mode: "on_site" as const,
      variant_id: selectedVariant.id,
      quantity,
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
    if (!selectedVariant || !productDetail) {
      setError("Select a product and variant.");
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
      variant_id: selectedVariant.id,
      quantity,
      product_title: productDetail.title,
      variant_label: selectedVariant.variant_label,
      price_aud: selectedVariant.price_aud,
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
          amount_cents: totalAud,
          note: `${productDetail.title} · ${selectedVariant.variant_label}`,
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

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <div>
          <h1>On-site sale</h1>
          <p className={styles.muted}>
            Desk sales for wall prints — Square reader, cash, or record a payment already taken.
          </p>
        </div>
        <Link className={styles.link} href="/admin/fulfilment">
          Fulfilment
        </Link>
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

      {loadError ? <p className={styles.error}>{loadError}</p> : null}

      <section className={styles.panel}>
        <h2>Print</h2>
        <label className={styles.field}>
          Product
          <select
            value={productId}
            onChange={(event) => {
              setProductId(event.target.value);
              setVariantId("");
            }}
          >
            <option value="">Select product…</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          Size / finish
          <select
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
            disabled={!activeVariants.length}
          >
            <option value="">Select variant…</option>
            {activeVariants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.variant_label} — {formatAUD(variant.price_aud)}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fieldNarrow}>
          Qty
          <input
            type="number"
            min={1}
            max={10}
            value={quantity}
            onChange={(event) => setQuantity(Number.parseInt(event.target.value || "1", 10) || 1)}
          />
        </label>

        <p className={styles.total}>
          Total <strong>{formatAUD(totalAud)}</strong>
        </p>
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
            disabled={busy || !selectedVariant}
            onClick={() => void chargeWithSquare()}
          >
            {busy ? "Working…" : "Charge with Square reader"}
          </button>
          <button
            className={styles.secondary}
            type="button"
            disabled={busy || !selectedVariant}
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
            disabled={busy || !selectedVariant || !squarePaymentId.trim()}
            onClick={() => void createOrder("square", squarePaymentId.trim())}
          >
            Mark paid after Square
          </button>
          <button
            className={styles.ghost}
            type="button"
            disabled={busy || !selectedVariant}
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
export type { PendingSale };
