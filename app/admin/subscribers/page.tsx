import { fetchAdminJson } from "../_lib/fetch-admin";
import { formatDateTime } from "../../../lib/utils/dates";
import styles from "./page.module.css";

type Subscriber = {
  id: string;
  email: string;
  first_name: string | null;
  source: string | null;
  is_confirmed: boolean;
  subscribed_at: string;
  unsubscribed_at: string | null;
};

export default async function AdminSubscribersPage() {
  const subscribers = await fetchAdminJson<Subscriber[]>("/api/admin/subscribers");
  const confirmedCount = subscribers.filter((subscriber) => subscriber.is_confirmed).length;

  return (
    <div>
      <div className={styles.topRow}>
        <h1>Subscribers</h1>
        <a className={styles.exportLink} href="/api/admin/subscribers/export">
          Export CSV
        </a>
      </div>
      <p className={styles.summary}>
        {subscribers.length} subscribers · {confirmedCount} confirmed
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>First Name</th>
              <th>Source</th>
              <th>Confirmed</th>
              <th>Subscribed At</th>
              <th>Unsubscribed At</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((subscriber) => (
              <tr key={subscriber.id}>
                <td>{subscriber.email}</td>
                <td>{subscriber.first_name ?? "—"}</td>
                <td>{subscriber.source ?? "—"}</td>
                <td>{subscriber.is_confirmed ? "Yes" : "No"}</td>
                <td>{formatDateTime(subscriber.subscribed_at)}</td>
                <td>{subscriber.unsubscribed_at ? formatDateTime(subscriber.unsubscribed_at) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
