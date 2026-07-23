import { fetchAdminJson } from "../_lib/fetch-admin";
import { TalkCapacityForm } from "../../../components/admin/TalkCapacityForm";
import { formatDateTime } from "../../../lib/utils/dates";
import styles from "../subscribers/page.module.css";

type TalkRegistrationsData = {
  metrics: {
    registrations: number;
    seats_taken: number;
    capacity: number;
    seats_remaining: number;
    waitlist_registrations: number;
    waitlist_seats: number;
    cancelled: number;
  };
  registrations: Array<{
    id: string;
    email: string;
    name: string;
    party_size: number;
    list: "confirmed" | "waitlist";
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
        {data.metrics.registrations} confirmed · {data.metrics.seats_taken}/{data.metrics.capacity} seats ·{" "}
        {data.metrics.seats_remaining} remaining · {data.metrics.waitlist_registrations} on wait list (
        {data.metrics.waitlist_seats} seats)
        {data.metrics.cancelled > 0 ? ` · ${data.metrics.cancelled} cancelled` : ""}
      </p>
      <p className={styles.summary} style={{ color: "#555" }}>
        Free ticketed places for Marcia van Zeller — Sunday 20 September, 11am–12pm.
      </p>

      <TalkCapacityForm initialCapacity={data.metrics.capacity} seatsTaken={data.metrics.seats_taken} />

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Party size</th>
              <th>List</th>
              <th>Source</th>
              <th>Registered</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.registrations.length === 0 ? (
              <tr>
                <td colSpan={7}>No registrations yet.</td>
              </tr>
            ) : (
              data.registrations.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.email}</td>
                  <td>{row.party_size}</td>
                  <td>{row.list === "waitlist" ? "Wait list" : "Confirmed"}</td>
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
