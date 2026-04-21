import { formatAUD } from "../../../lib/utils/currency";
import { fetchAdminJson } from "../_lib/fetch-admin";
import styles from "./page.module.css";

type SalesData = {
  metrics: {
    total_revenue_aud: number;
    average_order_value_aud: number;
    total_units_sold: number;
    total_orders: number;
  };
  revenue_by_product: Array<{
    product_title: string;
    variant_label: string;
    units_sold: number;
    revenue_aud: number;
  }>;
  status_breakdown: Array<{
    status: string;
    count: number;
  }>;
  revenue_by_week: Array<{
    week_start: string;
    revenue_aud: number;
  }>;
};

export default async function AdminSalesPage() {
  const data = await fetchAdminJson<SalesData>("/api/admin/sales");
  const maxStatusCount = Math.max(1, ...data.status_breakdown.map((row) => row.count));

  return (
    <div>
      <h1>Sales</h1>

      <section className={styles.metrics}>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Total revenue</p>
          <p className={styles.metricValue}>{formatAUD(data.metrics.total_revenue_aud)}</p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Average order value</p>
          <p className={styles.metricValue}>{formatAUD(data.metrics.average_order_value_aud)}</p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Total units sold</p>
          <p className={styles.metricValue}>{data.metrics.total_units_sold}</p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Total orders</p>
          <p className={styles.metricValue}>{data.metrics.total_orders}</p>
        </article>
      </section>

      <h2>Revenue by product</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Product title</th>
              <th>Variant</th>
              <th>Units sold</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.revenue_by_product.map((row, index) => (
              <tr key={`${row.product_title}-${row.variant_label}-${index}`}>
                <td>{row.product_title}</td>
                <td>{row.variant_label}</td>
                <td>{row.units_sold}</td>
                <td>{formatAUD(row.revenue_aud)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Orders by status</h2>
      <section>
        {data.status_breakdown.map((row) => (
          <div key={row.status} className={styles.barRow}>
            <div>
              {row.status} ({row.count})
            </div>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{ width: `${Math.round((row.count / maxStatusCount) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      <h2>Revenue by week</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Week start</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.revenue_by_week.map((row) => (
              <tr key={row.week_start}>
                <td>{row.week_start}</td>
                <td>{formatAUD(row.revenue_aud)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
