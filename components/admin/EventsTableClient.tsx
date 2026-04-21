"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import styles from "./EventsTableClient.module.css";

type EventListItem = {
  id: string;
  title: string;
  speaker_name: string | null;
  event_date: string;
  is_published: boolean;
};

type EventsTableClientProps = {
  events: EventListItem[];
};

export function EventsTableClient({ events }: EventsTableClientProps) {
  const router = useRouter();

  const togglePublished = async (id: string) => {
    await fetch(`/api/admin/events/${id}/toggle-published`, { method: "PATCH" });
    router.refresh();
  };

  return (
    <div>
      <div className={styles.topRow}>
        <h1>Events</h1>
        <Link className={styles.addBtn} href="/admin/events/new">
          Add Event
        </Link>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Speaker</th>
              <th>Date</th>
              <th>Published</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{event.title}</td>
                <td>{event.speaker_name ?? "—"}</td>
                <td>{new Date(event.event_date).toLocaleString()}</td>
                <td>{event.is_published ? "Yes" : "No"}</td>
                <td>
                  <div className={styles.actions}>
                    <Link href={`/admin/events/${event.id}/edit`}>Edit</Link>
                    <button type="button" onClick={() => togglePublished(event.id)}>
                      Toggle Published
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
