import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { OrderSuccessTracker } from "../../../components/OrderSuccessTracker";
import { buildMetadata } from "../../../lib/metadata";
import { queryPostgres } from "../../../lib/postgres";
import { stripe } from "../../../lib/stripe";
import { formatAUD } from "../../../lib/utils/currency";
import styles from "../../../components/OrderSuccessContent.module.css";

export const metadata: Metadata = buildMetadata({
  title: "Order Confirmed",
  noIndex: true,
});

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

type SuccessOrderRow = {
  order_number: string;
  total_aud: number;
  item: {
    photo_title: string;
    variant_label: string;
    edition_number_assigned: number | null;
    edition_size: number | null;
  };
};

const getOrderForSession = async (sessionId: string): Promise<SuccessOrderRow | null> => {
  const { rows } = await queryPostgres<SuccessOrderRow>(
    `
      select
        o.order_number,
        o.total_aud,
        json_build_object(
          'photo_title', p.title,
          'variant_label', pv.variant_label,
          'edition_number_assigned', oi.edition_number_assigned,
          'edition_size', pv.edition_size
        ) as item
      from exhibition.orders o
      join exhibition.order_items oi on oi.order_id = o.id
      join exhibition.product_variants pv on pv.id = oi.variant_id
      join exhibition.products p on p.id = pv.product_id
      where o.stripe_checkout_session_id = $1
      order by oi.id asc
      limit 1
    `,
    [sessionId],
  );

  return rows[0] ?? null;
};

export default async function OrderSuccessPage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    redirect("/shop");
  }

  try {
    await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    redirect("/shop");
  }

  const order = await getOrderForSession(sessionId);
  if (!order) {
    redirect("/shop");
  }

  const editionText = order.item.edition_number_assigned
    ? `Edition ${order.item.edition_number_assigned}${order.item.edition_size ? ` of ${order.item.edition_size}` : ""}`
    : "Edition number pending";

  return (
    <>
      <OrderSuccessTracker />
      <section className={`section container-narrow ${styles.wrap}`}>
        <h1 className="heading-section">Thank you.</h1>
        <p className={styles.subheading}>Your order has been confirmed.</p>

        <div className={styles.summary}>
          <p>
            <strong>Order:</strong> {order.order_number}
          </p>
          <p>
            <strong>Photograph:</strong> {order.item.photo_title}
          </p>
          <p>
            <strong>Size:</strong> {order.item.variant_label}
          </p>
          <p>
            <strong>Edition:</strong> {editionText}
          </p>
          <p>
            <strong>Total paid:</strong> {formatAUD(order.total_aud)}
          </p>
          <p>
            <strong>Estimated delivery:</strong> Please allow 3-4 business days for production and despatch.
          </p>
        </div>

        <p>
          You&apos;ll receive a confirmation email shortly with your order details. A second email will follow when your
          print has shipped.
        </p>

        <Link href="/shop" className={styles.link}>
          Back to the photographs →
        </Link>
      </section>
    </>
  );
}
