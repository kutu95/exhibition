"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { adminClientFetch, adminClientFetchError } from "../../lib/admin-client-fetch";
import {
  DISCOUNT_PERCENTS,
  perthCalendarDate,
  suggestDiscountCode,
  type DiscountCodeRow,
  type DiscountPercent,
} from "../../lib/discount-codes";
import { siteConfig } from "../../lib/metadata";
import styles from "./DiscountCodesClient.module.css";

type DiscountCodesClientProps = {
  codes: DiscountCodeRow[];
};

const formatBoardDate = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
};

export function DiscountCodesClient({ codes }: DiscountCodesClientProps) {
  const router = useRouter();
  const today = perthCalendarDate();
  const todaysCode = codes.find((row) => row.valid_on === today) ?? null;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [validOn, setValidOn] = useState(today);
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState<DiscountPercent>(15);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remainingDays = useMemo(() => {
    const used = new Set(codes.map((row) => row.valid_on));
    const start = new Date(`${siteConfig.exhibition.opens}T00:00:00Z`);
    const end = new Date(`${siteConfig.exhibition.closes}T00:00:00Z`);
    let count = 0;
    const cursor = new Date(start);
    while (cursor.getTime() <= end.getTime()) {
      if (!used.has(cursor.toISOString().slice(0, 10))) count += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
  }, [codes]);

  const resetForm = (nextDate = today) => {
    setEditingId(null);
    setValidOn(nextDate);
    setCode("");
    setPercentOff(15);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = { code, valid_on: validOn, percent_off: percentOff };
      const response = await adminClientFetch(
        editingId ? `/api/admin/discount-codes/${editingId}` : "/api/admin/discount-codes",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error ?? "Could not save that code.");
      }
      resetForm();
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : adminClientFetchError(saveError));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this day’s code?")) return;
    setBusy(true);
    setError(null);
    try {
      const response = await adminClientFetch(`/api/admin/discount-codes/${id}`, { method: "DELETE" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not remove that code.");
      if (editingId === id) resetForm();
      router.refresh();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : adminClientFetchError(removeError));
    } finally {
      setBusy(false);
    }
  };

  const fillRemaining = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await adminClientFetch("/api/admin/discount-codes/fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percent_off: percentOff }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not fill remaining days.");
      router.refresh();
    } catch (fillError) {
      setError(fillError instanceof Error ? fillError.message : adminClientFetchError(fillError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>Discount codes</h1>
      <p className={styles.intro}>
        Write today&apos;s code on the board at the exhibition. Each code works only on its day, from
        midnight to midnight in Western Australia. A visitor who copies it can still use it later that
        same day.
      </p>

      <div className={styles.today}>
        <strong>Today ({formatBoardDate(today)})</strong>
        {todaysCode ? (
          <p>
            {todaysCode.code} · {todaysCode.percent_off}% off
          </p>
        ) : (
          <p>No code set for today yet.</p>
        )}
      </div>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className={styles.fields}>
          <label className={styles.field}>
            Date
            <input type="date" value={validOn} onChange={(event) => setValidOn(event.target.value)} required />
          </label>
          <label className={styles.field}>
            Code
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="e.g. REDGATE"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </label>
          <label className={styles.field}>
            Percent
            <select
              value={percentOff}
              onChange={(event) => setPercentOff(Number(event.target.value) as DiscountPercent)}
            >
              {DISCOUNT_PERCENTS.map((percent) => (
                <option key={percent} value={percent}>
                  {percent}%
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.actions}>
          <button className={styles.primary} type="submit" disabled={busy}>
            {editingId ? "Save changes" : "Add code"}
          </button>
          <button
            className={styles.secondary}
            type="button"
            disabled={busy}
            onClick={() => setCode(suggestDiscountCode())}
          >
            Suggest code
          </button>
          {editingId ? (
            <button className={styles.secondary} type="button" disabled={busy} onClick={() => resetForm()}>
              Cancel edit
            </button>
          ) : null}
          {remainingDays > 0 ? (
            <button className={styles.secondary} type="button" disabled={busy} onClick={() => void fillRemaining()}>
              Fill {remainingDays} remaining Open Studios {remainingDays === 1 ? "day" : "days"} at {percentOff}%
            </button>
          ) : null}
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Code</th>
              <th>Off</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {codes.length === 0 ? (
              <tr>
                <td colSpan={4}>No codes yet. Add today&apos;s board code, or fill the Open Studios dates.</td>
              </tr>
            ) : (
              codes.map((row) => (
                <tr key={row.id} className={row.valid_on === today ? styles.todayRow : undefined}>
                  <td>{formatBoardDate(row.valid_on)}</td>
                  <td className={styles.code}>{row.code}</td>
                  <td>{row.percent_off}%</td>
                  <td>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(row.id);
                          setValidOn(row.valid_on);
                          setCode(row.code);
                          setPercentOff(row.percent_off as DiscountPercent);
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" disabled={busy} onClick={() => void remove(row.id)}>
                        Remove
                      </button>
                    </div>
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
