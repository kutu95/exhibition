"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

import styles from "./page.module.css";

function UnsubscribeForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">(
    token ? "idle" : "error",
  );
  const [message, setMessage] = useState(
    token ? "" : "This unsubscribe link is missing or incomplete.",
  );
  const [email, setEmail] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setStatus("working");
    setMessage("");
    try {
      const response = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        email?: string;
      } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not unsubscribe.");
      }
      setEmail(body?.email ?? null);
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not unsubscribe.");
    }
  };

  return (
    <section className={`section container ${styles.wrap}`}>
      <h1 className={styles.title}>Unsubscribe</h1>
      {status === "done" ? (
        <p className={styles.copy}>
          You have been unsubscribed{email ? ` (${email})` : ""}. You will not receive further
          exhibition emails from The Georgette 150th.
        </p>
      ) : (
        <>
          <p className={styles.copy}>
            Confirm that you no longer want exhibition updates by email.
          </p>
          {message ? <p className={styles.error}>{message}</p> : null}
          <form onSubmit={(event) => void handleSubmit(event)}>
            <button className="button-solid" type="submit" disabled={!token || status === "working"}>
              {status === "working" ? "Unsubscribing…" : "Unsubscribe from emails"}
            </button>
          </form>
        </>
      )}
    </section>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<p className="section container">Loading…</p>}>
      <UnsubscribeForm />
    </Suspense>
  );
}
