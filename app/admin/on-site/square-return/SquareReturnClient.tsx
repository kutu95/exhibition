"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  PENDING_SALE_KEY,
  type PendingSale,
} from "../../../../components/admin/OnSiteSaleClient";
import { parseSquarePosCallback } from "../../../../lib/square-pos";
import styles from "../../../../components/admin/OnSiteSaleClient.module.css";

export function SquareReturnClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Completing Square payment…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const result = parseSquarePosCallback(searchParams);
      if (!result.ok) {
        setError(result.errorDescription || result.errorCode || "Square payment was not completed.");
        setMessage("Square payment failed.");
        return;
      }

      const raw = sessionStorage.getItem(PENDING_SALE_KEY);
      if (!raw) {
        setError(
          "Payment may have succeeded in Square, but the pending sale details were lost. Use On-site sale → Mark paid after Square with the receipt id.",
        );
        setMessage("Missing pending sale.");
        return;
      }

      let pending: PendingSale;
      try {
        pending = JSON.parse(raw) as PendingSale;
      } catch {
        setError("Could not read pending sale details.");
        return;
      }

      const squareId =
        result.serverTransactionId ||
        result.clientTransactionId ||
        pending.client_transaction_id;

      const response = await fetch("/api/admin/orders/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "on_site",
          variant_id: pending.variant_id,
          quantity: pending.quantity,
          customer_email: pending.allow_placeholder_customer
            ? undefined
            : pending.customer_email || undefined,
          customer_name: pending.allow_placeholder_customer
            ? undefined
            : pending.customer_name || undefined,
          allow_placeholder_customer: pending.allow_placeholder_customer,
          fulfilment: pending.fulfilment,
          shipping_address:
            pending.fulfilment === "ship"
              ? { ...pending.shipping_address, method: "ship" }
              : undefined,
          payment_method: "square",
          square_payment_id: squareId,
          notes: pending.notes || undefined,
          send_confirmation_email: !pending.allow_placeholder_customer,
        }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        order_id?: string;
        order_number?: string;
      } | null;

      if (!response.ok) {
        setError(body?.error ?? "Could not create order after Square payment.");
        setMessage("Order creation failed.");
        return;
      }

      sessionStorage.removeItem(PENDING_SALE_KEY);
      setMessage(`Order ${body?.order_number ?? ""} created.`);
      if (body?.order_id) {
        router.replace(`/admin/orders/${body.order_id}`);
      } else {
        router.replace("/admin/on-site");
      }
    };

    void run();
  }, [router, searchParams]);

  return (
    <div className={styles.wrap}>
      <h1>Square return</h1>
      <p className={styles.muted}>{message}</p>
      {error ? (
        <>
          <p className={styles.error}>{error}</p>
          <Link className={styles.link} href="/admin/on-site">
            Back to on-site sale
          </Link>
        </>
      ) : null}
    </div>
  );
}
