import { fetchAdminJson } from "../_lib/fetch-admin";
import { EventsTableClient } from "../../../components/admin/EventsTableClient";

type EventRow = {
  id: string;
  title: string;
  speaker_name: string | null;
  event_date: string;
  is_published: boolean;
};

export default async function AdminEventsPage() {
  const events = await fetchAdminJson<EventRow[]>("/api/admin/events");
  return <EventsTableClient events={events} />;
}
