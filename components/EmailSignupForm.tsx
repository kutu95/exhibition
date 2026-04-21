"use client";

import { FormEvent, useMemo, useState } from "react";

import styles from "./EmailSignupForm.module.css";

type EmailSignupFormProps = {
  source: string;
  buttonLabel?: string;
  compact?: boolean;
};

type FormStatus = "idle" | "loading" | "success";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailSignupForm({
  source,
  buttonLabel = "Notify Me",
  compact = false,
}: EmailSignupFormProps) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = useMemo(() => emailRegex.test(email), [email]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isValidEmail) {
      setError("Enter a valid email address.");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          first_name: firstName || undefined,
          source,
        }),
      });

      if (!response.ok) {
        throw new Error("Subscription request failed.");
      }

      setStatus("success");
    } catch (submitError) {
      console.error(submitError);
      setError("Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  if (status === "success") {
    return <p className={styles.success}>You&apos;re on the list.</p>;
  }

  return (
    <form className={`${styles.form} ${compact ? styles.compact : ""}`} onSubmit={handleSubmit}>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor={`first-name-${source}`}>
          First name (optional)
        </label>
        <input
          id={`first-name-${source}`}
          className={styles.input}
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          autoComplete="given-name"
          placeholder="First name"
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor={`email-${source}`}>
          Email
        </label>
        <input
          id={`email-${source}`}
          className={styles.input}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
        />
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <button className={`button-solid ${styles.button}`} type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Submitting..." : buttonLabel}
      </button>
    </form>
  );
}
