"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { PlausibleEvents, trackEvent } from "@/lib/plausible";
import { TALK_WHEN_LABEL, type TalkList } from "@/lib/talk-registration";

import styles from "./EmailSignupForm.module.css";

type TalkRegistrationFormProps = {
  source: "installations_talk" | "visit_talk" | "home" | "other";
  compact?: boolean;
};

type FormStatus = "idle" | "loading" | "success" | "already" | "waitlist_success";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function TalkRegistrationForm({ source, compact = false }: TalkRegistrationFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seatsRemaining, setSeatsRemaining] = useState<number | null>(null);
  const [isFull, setIsFull] = useState(false);
  const [existingList, setExistingList] = useState<TalkList | null>(null);

  const isValidEmail = useMemo(() => emailRegex.test(email), [email]);
  const onWaitlist = isFull || (seatsRemaining !== null && seatsRemaining <= 0);
  const maxPartySize =
    seatsRemaining !== null && seatsRemaining > 0 ? Math.min(10, seatsRemaining) : 10;

  useEffect(() => {
    if (partySize > maxPartySize) setPartySize(maxPartySize);
  }, [maxPartySize, partySize]);

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
        if (typeof data.seats_remaining === "number") {
          setSeatsRemaining(data.seats_remaining);
          setIsFull(data.seats_remaining <= 0 || Boolean(data.is_full));
        } else if (data.is_full) {
          setIsFull(true);
          setSeatsRemaining(0);
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

  const submitRegistration = async (asWaitlist: boolean) => {
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
          waitlist: asWaitlist,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        already_registered?: boolean;
        list?: TalkList;
        error?: string;
        seats_remaining?: number;
        is_full?: boolean;
      };

      if (response.status === 409) {
        if (typeof data.seats_remaining === "number") {
          setSeatsRemaining(data.seats_remaining);
          setIsFull(data.seats_remaining <= 0);
        }
        setError(data.error ?? "Not enough seats available for that party size.");
        setStatus("idle");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Registration failed.");
      }

      if (typeof data.seats_remaining === "number") {
        setSeatsRemaining(data.seats_remaining);
        setIsFull(data.seats_remaining <= 0);
      }

      if (data.already_registered) {
        setExistingList(data.list ?? "confirmed");
        setStatus("already");
      } else if (data.list === "waitlist") {
        setStatus("waitlist_success");
      } else {
        setStatus("success");
      }

      trackEvent(PlausibleEvents.TALK_REGISTER, {
        source,
        party_size: partySize,
        list: data.list ?? (asWaitlist ? "waitlist" : "confirmed"),
        already_registered: Boolean(data.already_registered),
      });
    } catch (submitError) {
      console.error(submitError);
      setError(submitError instanceof Error ? submitError.message : "Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitRegistration(onWaitlist);
  };

  if (status === "success") {
    return (
      <p className={styles.success}>
        You&apos;re registered for {TALK_WHEN_LABEL}. We&apos;ll see you there.
      </p>
    );
  }

  if (status === "waitlist_success") {
    return (
      <p className={styles.success}>
        You&apos;re on the wait list. We&apos;ll email you if a place becomes available.
      </p>
    );
  }

  if (status === "already") {
    return (
      <p className={styles.success}>
        {existingList === "waitlist"
          ? "You're already on the wait list for this talk."
          : "You're already registered for this talk."}
      </p>
    );
  }

  return (
    <form className={`${styles.form} ${compact ? styles.compact : ""}`} onSubmit={handleSubmit}>
      {seatsRemaining !== null && !onWaitlist ? (
        <p className={styles.capacityHint}>
          {seatsRemaining} seat{seatsRemaining === 1 ? "" : "s"} available
        </p>
      ) : null}

      {onWaitlist ? (
        <p className={styles.capacityHint}>
          No seats currently available. Join the wait list and we&apos;ll contact you if a place opens up.
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
          {Array.from({ length: onWaitlist ? 10 : maxPartySize }, (_, index) => index + 1).map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div>
          <p className={styles.error}>{error}</p>
          {!onWaitlist && seatsRemaining !== null && seatsRemaining > 0 && partySize > seatsRemaining ? (
            <button
              className={`button-outline ${styles.button}`}
              type="button"
              onClick={() => void submitRegistration(true)}
            >
              Join the wait list instead
            </button>
          ) : null}
        </div>
      ) : null}

      <button className={`button-solid ${styles.button}`} type="submit" disabled={status === "loading"}>
        {status === "loading"
          ? onWaitlist
            ? "Joining wait list..."
            : "Reserving..."
          : onWaitlist
            ? "Join the wait list"
            : "Reserve free places"}
      </button>
    </form>
  );
}
