"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { PlausibleEvents, trackEvent } from "@/lib/plausible";
import { TALK_WHEN_LABEL } from "@/lib/talk-registration";

import styles from "./EmailSignupForm.module.css";

type TalkRegistrationFormProps = {
  source: "installations_talk" | "visit_talk" | "home" | "other";
  compact?: boolean;
};

type FormStatus = "idle" | "loading" | "success" | "already" | "full";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function TalkRegistrationForm({ source, compact = false }: TalkRegistrationFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seatsRemaining, setSeatsRemaining] = useState<number | null>(null);
  const [isFull, setIsFull] = useState(false);

  const isValidEmail = useMemo(() => emailRegex.test(email), [email]);

  useEffect(() => {
    let cancelled = false;
    const loadCapacity = async () => {
      try {
        const response = await fetch("/api/talk-register");
        if (!response.ok) return;
        const data = (await response.json()) as {
          seats_remaining?: number;
          is_full?: boolean;
        };
        if (cancelled) return;
        if (typeof data.seats_remaining === "number") setSeatsRemaining(data.seats_remaining);
        if (data.is_full) {
          setIsFull(true);
          setStatus("full");
        }
      } catch {
        // Capacity display is optional; registration can still proceed.
      }
    };
    void loadCapacity();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!isValidEmail) {
      setError("Enter a valid email address.");
      return;
    }

    setStatus("loading");

    try {
      const response = await fetch("/api/talk-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name.trim(),
          party_size: partySize,
          source,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        already_registered?: boolean;
        error?: string;
        seats_remaining?: number;
      };

      if (response.status === 409) {
        if (typeof data.seats_remaining === "number") setSeatsRemaining(data.seats_remaining);
        if (data.seats_remaining === 0) {
          setIsFull(true);
          setStatus("full");
        } else {
          setError(data.error ?? "Not enough places left for that party size.");
          setStatus("idle");
        }
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Registration failed.");
      }

      if (typeof data.seats_remaining === "number") setSeatsRemaining(data.seats_remaining);
      setStatus(data.already_registered ? "already" : "success");
      trackEvent(PlausibleEvents.TALK_REGISTER, {
        source,
        party_size: partySize,
        already_registered: Boolean(data.already_registered),
      });
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  if (status === "success" || status === "already") {
    return (
      <p className={styles.success}>
        {status === "already"
          ? "You're already registered for this talk."
          : `You're registered for ${TALK_WHEN_LABEL}. We'll see you there.`}
      </p>
    );
  }

  if (status === "full" || isFull) {
    return (
      <p className={styles.success}>
        This talk is fully booked. Join the mailing list elsewhere on the site for exhibition updates.
      </p>
    );
  }

  return (
    <form className={`${styles.form} ${compact ? styles.compact : ""}`} onSubmit={handleSubmit}>
      {seatsRemaining !== null ? (
        <p className={styles.capacityHint}>
          {seatsRemaining} free place{seatsRemaining === 1 ? "" : "s"} remaining
        </p>
      ) : null}

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor={`talk-name-${source}`}>
          Name
        </label>
        <input
          id={`talk-name-${source}`}
          className={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="name"
          placeholder="Your name"
          required
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor={`talk-email-${source}`}>
          Email
        </label>
        <input
          id={`talk-email-${source}`}
          className={styles.input}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          required
        />
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor={`talk-party-${source}`}>
          Number of people
        </label>
        <select
          id={`talk-party-${source}`}
          className={styles.input}
          value={partySize}
          onChange={(event) => setPartySize(Number.parseInt(event.target.value, 10))}
        >
          {Array.from({ length: 10 }, (_, index) => index + 1).map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <button className={`button-solid ${styles.button}`} type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Reserving..." : "Reserve free places"}
      </button>
    </form>
  );
}
