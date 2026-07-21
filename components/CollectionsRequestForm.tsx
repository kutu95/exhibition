"use client";

import { useState } from "react";

import styles from "./CollectionsRequestForm.module.css";

export function CollectionsRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [interest, setInterest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/collections/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        organisation: organisation.trim() || null,
        interest,
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not send your request. Please try again.");
      return;
    }

    setDone(true);
  };

  if (done) {
    return (
      <div className={styles.success}>
        <p>Thank you. We have received your request and will be in touch if we can offer access.</p>
      </div>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
      </label>
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          maxLength={200}
        />
      </label>
      <label>
        Organisation <span className={styles.optional}>(optional)</span>
        <input
          value={organisation}
          onChange={(event) => setOrganisation(event.target.value)}
          maxLength={200}
          placeholder="Studio, gallery, or company"
        />
      </label>
      <label>
        Your interest
        <textarea
          value={interest}
          onChange={(event) => setInterest(event.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="A few words about why you’d like to see further collections"
        />
      </label>
      {error ? <p className={styles.error}>{error}</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Request access"}
      </button>
    </form>
  );
}
