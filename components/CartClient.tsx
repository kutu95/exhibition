"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { useCart } from "./CartProvider";
import { usePurchasesAllowed } from "./PurchasesAccessProvider";
import styles from "./CartClient.module.css";
import { PlausibleEvents, trackEvent } from "../lib/plausible";
import { PURCHASES_DISABLED_MESSAGE } from "../lib/purchases-access";
import { formatAUD } from "../lib/utils/currency";

export function CartClient() {
  const { items, itemCount, subtotalAud, updateQuantity, removeItem } = useCart();
  const purchasesAllowed = usePurchasesAllowed();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    if (!purchasesAllowed || items.length === 0) return;

    try {
      setIsCheckingOut(true);
      setError(null);

      trackEvent(PlausibleEvents.SHOP_CHECKOUT_START, {
        items: itemCount,
        subtotal: subtotalAud,
      });

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            variant_id: item.variant_id,
            quantity: item.quantity,
          })),
        }),
      });

      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Checkout request failed.");
      }

      window.location.href = data.url;
    } catch (checkoutError) {
      console.error(checkoutError);
      setError("Unable to start checkout. Please try again.");
      setIsCheckingOut(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className={styles.empty}>
        <p>Your cart is empty.</p>
        <Link className="button-solid" href="/shop">
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.variant_id} className={styles.row}>
            <Link href={`/shop/${item.slug}`} className={styles.thumb}>
              <Image src={item.image_url} alt={item.product_title} fill sizes="96px" className={styles.thumbImage} />
            </Link>
            <div className={styles.details}>
              <Link href={`/shop/${item.slug}`}>
                <strong>{item.product_title}</strong>
              </Link>
              <p>{item.variant_label}</p>
              <p>{formatAUD(item.price_aud)}</p>
            </div>
            <div className={styles.qty}>
              <label>
                Qty
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(event) =>
                    updateQuantity(item.variant_id, Number.parseInt(event.target.value || "1", 10) || 1)
                  }
                />
              </label>
              <button type="button" className={styles.remove} onClick={() => removeItem(item.variant_id)}>
                Remove
              </button>
            </div>
            <p className={styles.lineTotal}>{formatAUD(item.price_aud * item.quantity)}</p>
          </li>
        ))}
      </ul>

      <aside className={styles.summary}>
        <p>
          <strong>Subtotal</strong>
          <span>{formatAUD(subtotalAud)}</span>
        </p>
        <p className={styles.note}>Shipping calculated at checkout. Free within Australia.</p>
        {purchasesAllowed ? (
          <button className="button-solid" type="button" onClick={handleCheckout} disabled={isCheckingOut}>
            {isCheckingOut ? "Redirecting..." : "Checkout"}
          </button>
        ) : (
          <p className={styles.purchaseNotice}>
            {PURCHASES_DISABLED_MESSAGE}{" "}
            <Link href="/contact">Contact</Link>
          </p>
        )}
        <Link href="/shop" className={styles.continue}>
          Continue shopping
        </Link>
        {error ? <p className={styles.error}>{error}</p> : null}
      </aside>
    </div>
  );
}
