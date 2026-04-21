import Link from "next/link";

import { fetchAdminJson } from "./_lib/fetch-admin";
import styles from "./page.module.css";

type DashboardData = {
  totals: {
    totalOrders: number;
    revenueAudCents: number;
    pendingDespatch: number;
    subscribers: number;
  };
  recentOrders: Array<{
    id: string;
    order_number: string;
    customer_name: string | null;
    status: string;
    total_aud: number | null;
    created_at: string;
  }>;
};

const formatAud = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

export default async function AdminDashboardPage() {
  const data = await fetchAdminJson<DashboardData>("/api/admin/dashboard");

  return (
    <div>
      <h1>Dashboard</h1>

      <section className={styles.grid}>
        <article className={styles.card}>
          <p className={styles.cardLabel}>Total Orders</p>
          <p className={styles.cardValue}>{data.totals.totalOrders}</p>
        </article>
        <article className={styles.card}>
          <p className={styles.cardLabel}>Revenue</p>
          <p className={styles.cardValue}>{formatAud(data.totals.revenueAudCents)}</p>
        </article>
        <article className={styles.card}>
          <p className={styles.cardLabel}>Pending Despatch</p>
          <p className={styles.cardValue}>{data.totals.pendingDespatch}</p>
        </article>
        <article className={styles.card}>
          <p className={styles.cardLabel}>Subscribers</p>
          <p className={styles.cardValue}>{data.totals.subscribers}</p>
        </article>
      </section>

      <h2>Recent Orders</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Customer Name</th>
              <th>Status</th>
              <th>Total</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.recentOrders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link className={styles.tableLink} href={`/admin/orders/${order.id}`}>
                    {order.order_number}
                  </Link>
                </td>
                <td>{order.customer_name ?? "—"}</td>
                <td>{order.status}</td>
                <td>{formatAud(order.total_aud ?? 0)}</td>
                <td>{new Date(order.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
