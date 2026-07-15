"use client";

import { useEffect } from "react";

import { databaseErrorMessage, isDatabaseConnectionError } from "../../lib/db-errors";
import styles from "./admin.module.css";

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error("Admin page failed to render", error);
  }, [error]);

  const isDatabaseIssue = isDatabaseConnectionError(error);
  const message = isDatabaseIssue
    ? databaseErrorMessage(error)
    : "Something went wrong while loading this admin page.";

  return (
    <div className={styles.statusPanel}>
      <h1>{isDatabaseIssue ? "Database unavailable" : "Could not load page"}</h1>
      <p className={styles.statusMessage}>{message}</p>
      {isDatabaseIssue ? (
        <p className={styles.statusHint}>
          Confirm Supabase/Postgres is running, then retry. On local dev, check{" "}
          <code>DATABASE_URL</code> or your Supabase connection settings in <code>.env.local</code>.
        </p>
      ) : null}
      <button className={styles.retryButton} type="button" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
