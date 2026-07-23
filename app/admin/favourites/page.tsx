import Link from "next/link";

import { fetchAdminJson } from "../_lib/fetch-admin";
import styles from "../sales/page.module.css";

type FavouritesData = {
  metrics: {
    total_favourites: number;
    products_favourited: number;
  };
  by_product: Array<{
    product_id: string;
    title: string;
    slug: string;
    product_type: string;
    location_tag: string | null;
    is_available: boolean;
    favourite_count: number;
  }>;
};

export default async function AdminFavouritesPage() {
  const data = await fetchAdminJson<FavouritesData>("/api/admin/favourites");
  const maxCount = Math.max(1, ...data.by_product.map((row) => row.favourite_count));

  return (
    <div>
      <h1>Favourites</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Unique visitors who marked each photograph as a favourite (anonymous, no login required).
      </p>

      <section className={styles.metrics}>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Total favourites</p>
          <p className={styles.metricValue}>{data.metrics.total_favourites}</p>
        </article>
        <article className={styles.metricCard}>
          <p className={styles.metricLabel}>Products favourited</p>
          <p className={styles.metricValue}>{data.metrics.products_favourited}</p>
        </article>
      </section>

      <h2>Most favourited</h2>
      {data.by_product.length === 0 ? (
        <p>No favourites recorded yet.</p>
      ) : (
        <>
          <section>
            {data.by_product.slice(0, 12).map((row) => (
              <div key={row.product_id} className={styles.barRow}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                  <span>{row.title}</span>
                  <strong>{row.favourite_count}</strong>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${Math.round((row.favourite_count / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </section>

          <div className={styles.tableWrap} style={{ marginTop: "1.5rem" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Available</th>
                  <th>Favourites</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.by_product.map((row) => (
                  <tr key={row.product_id}>
                    <td>{row.title}</td>
                    <td>{row.product_type}</td>
                    <td>{row.location_tag ?? "—"}</td>
                    <td>{row.is_available ? "Yes" : "No"}</td>
                    <td>{row.favourite_count}</td>
                    <td>
                      {row.slug ? (
                        <Link href={`/shop/${row.slug}`} target="_blank" rel="noreferrer">
                          View
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
