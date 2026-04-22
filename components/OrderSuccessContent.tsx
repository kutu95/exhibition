"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import styles from "./OrderSuccessContent.module.css";

export function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <section className={`section container-narrow ${styles.wrap}`}>
      <h1 className="heading-section">Thank you.</h1>
      <p className={styles.subheading}>Your order has been received.</p>
      <p>
        You&apos;ll receive a confirmation email shortly with your order details.
      </p>
      <p>
        All prints are made to order on archival paper and signed and numbered by John Bowskill. Please allow 2–3
        weeks for production and despatch. If you have any questions about your order, contact us at hello@margies.app
        and include your order number.
      </p>
      {sessionId ? <p className={styles.session}>Checkout reference: {sessionId}</p> : null}
      <Link href="/shop" className={styles.link}>
        Back to the photographs →
      </Link>
    </section>
  );
}
