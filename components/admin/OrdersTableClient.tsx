"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatAUD } from "../../lib/utils/currency";
import { StatusBadge } from "./StatusBadge";
import styles from "./OrdersTableClient.module.css";

type OrderListItem = {
  id: string;
  order_number: string;
  customer_name: string | null;
  customer_email: string;
  status: string;
  items_count: number;
  total_aud: number | null;
  created_at: string;
};

type OrdersTableClientProps = {
  orders: OrderListItem[];
};

export function OrdersTableClient({ orders }: OrdersTableClientProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const statusMatch = statusFilter === "all" ? true : order.status === statusFilter;
      const searchMatch =
        term.length === 0
          ? true
          : order.order_number.toLowerCase().includes(term) ||
            order.customer_email.toLowerCase().includes(term);
      return statusMatch && searchMatch;
    });
  }, [orders, search, statusFilter]);

  return (
    <div>
      <div className={styles.controls}>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>

        <input
          type="search"
          placeholder="Search order # or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Customer Name</th>
              <th>Customer Email</th>
              <th>Status</th>
              <th>Items</th>
              <th>Total AUD</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link className={styles.link} href={`/admin/orders/${order.id}`}>
                    {order.order_number}
                  </Link>
                </td>
                <td>{order.customer_name ?? "—"}</td>
                <td>{order.customer_email}</td>
                <td>
                  <StatusBadge status={order.status} />
                </td>
                <td>{order.items_count}</td>
                <td>{formatAUD(order.total_aud ?? 0)}</td>
                <td>{new Date(order.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
