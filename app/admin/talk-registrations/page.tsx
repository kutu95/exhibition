import { fetchAdminJson } from "../_lib/fetch-admin";
import { formatDateTime } from "../../../lib/utils/dates";
import styles from "../subscribers/page.module.css";

type TalkRegistrationsData = {
  metrics: {
    registrations: number;
    seats_taken: number;
    capacity: number;
    seats_remaining: number;
    cancelled: number;
  };
  registrations: Array<{
    id: string;
    email: string;
    name: string;
    party_size: number;
    source: string | null;
    created_at: string;
    cancelled_at: string | null;
  }>;
};

export default async function AdminTalkRegistrationsPage() {
  const data = await fetchAdminJson<TalkRegistrationsData>("/api/admin/talk-registrations");

  return (
    <div>
      <div className={styles.topRow}>
        <h1>Talk registrations</h1>
        <a className={styles.exportLink} href="/api/admin/talk-registrations/export">
          Export CSV
        </a>
      </div>
      <p className={styles.summary}>
        {data.metrics.registrations} registrations · {data.metrics.seats_taken} seats reserved ·{" "}
        {data.metrics.seats_remaining} of {data.metrics.capacity} remaining
        {data.metrics.cancelled > 0 ? ` · ${data.metrics.cancelled} cancelled` : ""}
      </p>
      <p className={styles.summary} style={{ color: "#555" }}>
        Free ticketed places for Marcia van Zeller — Sunday 20 September, 11am–12pm.
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Party size</th>
              <th>Source</th>
              <th>Registered</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.registrations.length === 0 ? (
              <tr>
                <td colSpan={6}>No registrations yet.</td>
              </tr>
            ) : (
              data.registrations.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.email}</td>
                  <td>{row.party_size}</td>
                  <td>{row.source ?? "—"}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{row.cancelled_at ? "Cancelled" : "Active"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
