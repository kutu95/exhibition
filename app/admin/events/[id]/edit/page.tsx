import { notFound } from "next/navigation";

import { EventEditorForm } from "../../../../../components/admin/EventEditorForm";
import { fetchAdminJson } from "../../../_lib/fetch-admin";

type EventRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  event_date: string;
  duration_minutes: number | null;
  location_name: string | null;
  speaker_name: string | null;
  speaker_bio: string | null;
  is_ticketed: boolean;
  ticket_url: string | null;
  is_published: boolean;
};

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditEventPage({ params }: PageProps) {
  const { id } = await params;

  let eventRow: EventRow;
  try {
    eventRow = await fetchAdminJson<EventRow>(`/api/admin/events/${id}`);
  } catch {
    notFound();
  }

  return (
    <EventEditorForm
      mode="edit"
      initialData={{
        id: eventRow.id,
        title: eventRow.title,
        slug: eventRow.slug,
        description: eventRow.description ?? "",
        event_date: eventRow.event_date,
        duration_minutes: eventRow.duration_minutes?.toString() ?? "",
        location_name: eventRow.location_name ?? "",
        speaker_name: eventRow.speaker_name ?? "",
        speaker_bio: eventRow.speaker_bio ?? "",
        is_ticketed: eventRow.is_ticketed,
        ticket_url: eventRow.ticket_url ?? "",
        is_published: eventRow.is_published,
      }}
    />
  );
}
