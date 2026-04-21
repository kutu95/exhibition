"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { slugify } from "../../lib/utils/slugify";
import styles from "./EventEditorForm.module.css";

type EventEditorInitialData = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  event_date: string;
  duration_minutes: string;
  location_name: string;
  speaker_name: string;
  speaker_bio: string;
  is_ticketed: boolean;
  ticket_url: string;
  is_published: boolean;
};

type EventEditorFormProps = {
  mode: "new" | "edit";
  initialData?: EventEditorInitialData;
};

const toDatetimeLocal = (value?: string): string => {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

export function EventEditorForm({ mode, initialData }: EventEditorFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [slug, setSlug] = useState(initialData?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initialData?.slug));
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [eventDate, setEventDate] = useState(toDatetimeLocal(initialData?.event_date));
  const [durationMinutes, setDurationMinutes] = useState(initialData?.duration_minutes ?? "");
  const [locationName, setLocationName] = useState(initialData?.location_name ?? "");
  const [speakerName, setSpeakerName] = useState(initialData?.speaker_name ?? "");
  const [speakerBio, setSpeakerBio] = useState(initialData?.speaker_bio ?? "");
  const [isTicketed, setIsTicketed] = useState(initialData?.is_ticketed ?? false);
  const [ticketUrl, setTicketUrl] = useState(initialData?.ticket_url ?? "");
  const [isPublished, setIsPublished] = useState(initialData?.is_published ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugSuggestion = useMemo(() => slugify(title), [title]);

  const handleSave = async () => {
    if (!title.trim() || !slug.trim() || !eventDate) {
      setError("Title, slug, and event date are required.");
      return;
    }

    const payload = {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      event_date: new Date(eventDate).toISOString(),
      duration_minutes: durationMinutes ? Number.parseInt(durationMinutes, 10) : null,
      location_name: locationName.trim() || null,
      speaker_name: speakerName.trim() || null,
      speaker_bio: speakerBio.trim() || null,
      is_ticketed: isTicketed,
      ticket_url: isTicketed ? ticketUrl.trim() || null : null,
      is_published: isPublished,
    };

    setSaving(true);
    setError(null);

    const endpoint = mode === "new" ? "/api/admin/events" : `/api/admin/events/${initialData?.id}`;
    const method = mode === "new" ? "POST" : "PATCH";
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({ error: "Failed to save event." }))) as {
        error?: string;
      };
      setError(data.error ?? "Failed to save event.");
      setSaving(false);
      return;
    }

    router.push("/admin/events");
    router.refresh();
  };

  return (
    <div>
      <h1>{mode === "new" ? "Add Event" : "Edit Event"}</h1>
      <div className={styles.form}>
        <section className={styles.panel}>
          <div className={styles.grid}>
            <label>
              Title
              <input
                value={title}
                onChange={(event) => {
                  const nextTitle = event.target.value;
                  setTitle(nextTitle);
                  if (!slugTouched) setSlug(slugify(nextTitle));
                }}
              />
            </label>
            <label>
              Slug
              <input
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
              />
            </label>
            <small>Suggested: {slugSuggestion || "n/a"}</small>

            <label>
              Description
              <textarea value={description} rows={5} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label>
              Event Date
              <input type="datetime-local" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
            </label>
            <label>
              Duration Minutes
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(event.target.value)}
              />
            </label>
            <label>
              Location Name
              <input value={locationName} onChange={(event) => setLocationName(event.target.value)} />
            </label>
            <label>
              Speaker Name
              <input value={speakerName} onChange={(event) => setSpeakerName(event.target.value)} />
            </label>
            <label>
              Speaker Bio
              <textarea value={speakerBio} rows={4} onChange={(event) => setSpeakerBio(event.target.value)} />
            </label>
            <label>
              <input type="checkbox" checked={isTicketed} onChange={(event) => setIsTicketed(event.target.checked)} />
              {" "}Is Ticketed
            </label>
            {isTicketed ? (
              <label>
                Ticket URL
                <input value={ticketUrl} onChange={(event) => setTicketUrl(event.target.value)} />
              </label>
            ) : null}
            <label>
              <input type="checkbox" checked={isPublished} onChange={(event) => setIsPublished(event.target.checked)} />
              {" "}Is Published
            </label>
          </div>
        </section>

        {error ? <p className={styles.error}>{error}</p> : null}
        <div className={styles.actions}>
          <button className={styles.btn} type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Event"}
          </button>
          <Link className={styles.btnAlt} href="/admin/events">
            Cancel
          </Link>
        </div>
      </div>
    </div>
  );
}
