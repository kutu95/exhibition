"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import styles from "./OrderSuccessContent.module.css";

export function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  return (
    <section className={`section container-narrow ${styles.wrap}`}>
      <p className="eyebrow">Order complete</p>
      <h1 className="heading-section">Thank you.</h1>
      <p className={styles.subheading}>Your order has been received.</p>
      <p>
        You&apos;ll receive a confirmation email shortly. Prints are made to order — please allow 2–3
        weeks for production and despatch.
      </p>
      {sessionId ? <p className={styles.session}>Checkout reference: {sessionId}</p> : null}
      <Link href="/shop" className={styles.link}>
        Return to shop →
      </Link>
    </section>
  );
}
