"use client";

import { useMemo, useState } from "react";

import { adminClientFetch } from "../../lib/admin-client-fetch";
import { formatDateTime } from "../../lib/utils/dates";
import styles from "./VaultAdminClient.module.css";

type AccessRequest = {
  id: string;
  name: string;
  email: string;
  interest: string;
  organisation: string | null;
  status: "pending" | "approved" | "declined";
  admin_note: string | null;
  invite_id: string | null;
  reviewed_at: string | null;
  created_at: string;
};

type Invite = {
  id: string;
  label: string;
  email: string | null;
  access_request_id: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  access_url?: string;
  email_sent?: boolean;
  email_error?: string | null;
};

type VaultAdminClientProps = {
  initialRequests: AccessRequest[];
  initialInvites: Invite[];
};

export function VaultAdminClient({ initialRequests, initialInvites }: VaultAdminClientProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [invites, setInvites] = useState(initialInvites);
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastAccessUrl, setLastAccessUrl] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "pending").length,
    [requests],
  );

  const createInvite = async () => {
    if (!label.trim()) return;
    setCreating(true);
    setError(null);
    setMessage(null);

    const response = await adminClientFetch("/api/admin/vault/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: label.trim(),
        email: email.trim() || null,
        send_email: sendEmail && Boolean(email.trim()),
      }),
    });

    setCreating(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to create invite.");
      return;
    }

    const body = (await response.json()) as Invite;
    setInvites((current) => [body, ...current]);
    setLastAccessUrl(body.access_url ?? null);
    setLabel("");
    setEmail("");
    setMessage(
      body.email_sent
        ? "Invite created and emailed."
        : body.access_url
          ? "Invite created. Copy the access link below."
          : "Invite created.",
    );
  };

  const revokeInvite = async (id: string) => {
    setBusyId(id);
    setError(null);
    const response = await adminClientFetch(`/api/admin/vault/invites/${id}/revoke`, {
      method: "POST",
    });
    setBusyId(null);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to revoke invite.");
      return;
    }

    const body = (await response.json()) as Invite;
    setInvites((current) => current.map((invite) => (invite.id === id ? body : invite)));
    setMessage("Invite revoked.");
  };

  const reviewRequest = async (id: string, action: "approve" | "decline") => {
    setBusyId(id);
    setError(null);
    setMessage(null);

    const response = await adminClientFetch(`/api/admin/vault/requests/${id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        send_email: action === "approve",
      }),
    });

    setBusyId(null);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Failed to review request.");
      return;
    }

    const body = (await response.json()) as {
      request?: AccessRequest;
      invite?: Invite;
    } & AccessRequest;

    if (action === "decline") {
      const declined = body as AccessRequest;
      setRequests((current) => current.map((item) => (item.id === id ? declined : item)));
      setMessage("Request declined.");
      return;
    }

    if (body.request) {
      setRequests((current) => current.map((item) => (item.id === id ? body.request! : item)));
    }
    if (body.invite) {
      setInvites((current) => [body.invite!, ...current]);
      setLastAccessUrl(body.invite.access_url ?? null);
      setMessage(
        body.invite.email_sent
          ? "Request approved and access emailed."
          : "Request approved. Copy the access link below (email may not be configured).",
      );
    }
  };

  return (
    <div className={styles.wrap}>
      <p className={styles.summary}>{pendingCount} pending access request{pendingCount === 1 ? "" : "s"}</p>
      {message ? <p className={styles.message}>{message}</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}
      {lastAccessUrl ? (
        <div className={styles.linkBox}>
          <p>Access link (shown once):</p>
          <code>{lastAccessUrl}</code>
          <button type="button" onClick={() => void navigator.clipboard.writeText(lastAccessUrl)}>
            Copy link
          </button>
        </div>
      ) : null}

      <section className={styles.panel}>
        <h2>Access requests</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Name</th>
                <th>Email</th>
                <th>Interest</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6}>No requests yet.</td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id}>
                    <td>{formatDateTime(request.created_at)}</td>
                    <td>
                      <strong>{request.name}</strong>
                      {request.organisation ? <div className={styles.muted}>{request.organisation}</div> : null}
                    </td>
                    <td>{request.email}</td>
                    <td className={styles.interest}>{request.interest}</td>
                    <td>{request.status}</td>
                    <td className={styles.actions}>
                      {request.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            disabled={busyId === request.id}
                            onClick={() => void reviewRequest(request.id, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className={styles.secondary}
                            disabled={busyId === request.id}
                            onClick={() => void reviewRequest(request.id, "decline")}
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Create invite</h2>
        <p className={styles.muted}>For collectors, friends, or decorators you already know.</p>
        <div className={styles.createRow}>
          <label>
            Label
            <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Sophie — decorator" />
          </label>
          <label>
            Email (optional)
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="to receive the link"
            />
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />
            Email the link when an address is provided
          </label>
          <button type="button" onClick={() => void createInvite()} disabled={creating || !label.trim()}>
            {creating ? "Creating…" : "Create invite"}
          </button>
        </div>
      </section>

      <section className={styles.panel}>
        <h2>Invites</h2>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Created</th>
                <th>Label</th>
                <th>Email</th>
                <th>Last used</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 ? (
                <tr>
                  <td colSpan={6}>No invites yet.</td>
                </tr>
              ) : (
                invites.map((invite) => (
                  <tr key={invite.id}>
                    <td>{formatDateTime(invite.created_at)}</td>
                    <td>{invite.label}</td>
                    <td>{invite.email ?? "—"}</td>
                    <td>{invite.last_used_at ? formatDateTime(invite.last_used_at) : "—"}</td>
                    <td>{invite.revoked_at ? "revoked" : "active"}</td>
                    <td>
                      {!invite.revoked_at ? (
                        <button
                          type="button"
                          className={styles.secondary}
                          disabled={busyId === invite.id}
                          onClick={() => void revokeInvite(invite.id)}
                        >
                          Revoke
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
