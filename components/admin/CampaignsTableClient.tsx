"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { EmailCampaign } from "../../lib/supabase/types";
import { formatDateTime } from "../../lib/utils/dates";
import styles from "./CampaignsTableClient.module.css";

type CampaignsTableClientProps = {
  campaigns: EmailCampaign[];
  audienceCount: number;
};

export function CampaignsTableClient({ campaigns, audienceCount }: CampaignsTableClientProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState(campaigns);

  const createCampaign = async () => {
    setBusyId("new");
    setError(null);
    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await response.json().catch(() => null)) as EmailCampaign & { error?: string };
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not create campaign.");
      }
      router.push(`/admin/campaigns/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create campaign.");
      setBusyId(null);
    }
  };

  const cloneCampaign = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/campaigns/${id}/clone`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as EmailCampaign & { error?: string };
      if (!response.ok) {
        throw new Error(body?.error ?? "Clone failed.");
      }
      router.push(`/admin/campaigns/${body.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Clone failed.");
      setBusyId(null);
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!window.confirm("Delete this campaign?")) return;
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Delete failed.");
      }
      setRows((current) => current.filter((row) => row.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className={styles.topRow}>
        <div>
          <h1>Email campaigns</h1>
          <p className={styles.summary}>
            {audienceCount} active subscriber{audienceCount === 1 ? "" : "s"} (not unsubscribed)
          </p>
        </div>
        <button className={styles.primaryBtn} type="button" onClick={() => void createCampaign()} disabled={busyId === "new"}>
          {busyId === "new" ? "Creating…" : "New campaign"}
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Sent</th>
              <th>Stats</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8}>No campaigns yet.</td>
              </tr>
            ) : (
              rows.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <Link href={`/admin/campaigns/${campaign.id}`}>{campaign.name}</Link>
                  </td>
                  <td>{campaign.subject || "—"}</td>
                  <td>{campaign.status}</td>
                  <td>{campaign.scheduled_at ? formatDateTime(campaign.scheduled_at) : "—"}</td>
                  <td>{campaign.sent_at ? formatDateTime(campaign.sent_at) : "—"}</td>
                  <td>
                    {campaign.status === "sent" || campaign.status === "failed"
                      ? `${campaign.sent_count} sent · ${campaign.failed_count} failed`
                      : "—"}
                  </td>
                  <td>{formatDateTime(campaign.updated_at)}</td>
                  <td className={styles.actions}>
                    <Link href={`/admin/campaigns/${campaign.id}`}>Edit</Link>
                    <button type="button" onClick={() => void cloneCampaign(campaign.id)} disabled={busyId === campaign.id}>
                      Clone
                    </button>
                    <button type="button" onClick={() => void deleteCampaign(campaign.id)} disabled={busyId === campaign.id}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
