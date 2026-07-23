"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "../../app/admin/subscribers/page.module.css";

type TalkCapacityFormProps = {
  initialCapacity: number;
  seatsTaken: number;
};

export function TalkCapacityForm({ initialCapacity, seatsTaken }: TalkCapacityFormProps) {
  const router = useRouter();
  const [capacity, setCapacity] = useState(String(initialCapacity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const next = Number.parseInt(capacity, 10);
    if (!Number.isFinite(next) || next < 1 || next > 500) {
      setError("Enter a whole number between 1 and 500.");
      return;
    }
    if (next < seatsTaken) {
      setError(
        `Capacity cannot be below seats already reserved (${seatsTaken}). Cancel registrations first, or set ${seatsTaken} or higher.`,
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/talk-registrations/capacity", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacity: next }),
      });
      const data = (await response.json()) as { capacity?: number; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Could not save capacity.");
      }
      setCapacity(String(data.capacity ?? next));
      setMessage("Capacity saved.");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save capacity.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ margin: "0 0 1.2rem", display: "grid", gap: "0.55rem", maxWidth: "22rem" }}>
      <label style={{ display: "grid", gap: "0.3rem", fontSize: "0.9rem" }}>
        Seat capacity
        <input
          type="number"
          min={1}
          max={500}
          step={1}
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          style={{
            border: "1px solid #d8d8d8",
            padding: "0.45rem 0.55rem",
            font: "inherit",
            width: "8rem",
          }}
        />
      </label>
      <p className={styles.summary} style={{ color: "#555", margin: 0 }}>
        Public pages show how many seats remain. This total is not shown to visitors.
      </p>
      {error ? <p style={{ color: "#7a1400", margin: 0 }}>{error}</p> : null}
      {message ? <p style={{ margin: 0 }}>{message}</p> : null}
      <button type="submit" className={styles.exportLink} disabled={saving} style={{ width: "fit-content", cursor: "pointer" }}>
        {saving ? "Saving..." : "Save capacity"}
      </button>
    </form>
  );
}
