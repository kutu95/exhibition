"use client";

import { useEffect, useId, useState } from "react";

import {
  DISCOUNT_CODE_STORAGE_KEY,
  DISCOUNT_INVALID_MESSAGE,
  discountAmountCents,
  normalizeDiscountCode,
} from "../lib/discount-codes";
import { formatAUD } from "../lib/utils/currency";
import styles from "./DiscountCodeField.module.css";

type AppliedDiscount = {
  code: string;
  percent_off: number;
};

const readStoredCode = (): string => {
  if (typeof window === "undefined") return "";
  try {
    return normalizeDiscountCode(window.localStorage.getItem(DISCOUNT_CODE_STORAGE_KEY) ?? "");
  } catch {
    return "";
  }
};

const writeStoredCode = (code: string) => {
  if (typeof window === "undefined") return;
  try {
    if (code) window.localStorage.setItem(DISCOUNT_CODE_STORAGE_KEY, code);
    else window.localStorage.removeItem(DISCOUNT_CODE_STORAGE_KEY);
  } catch {
    // Ignore private-mode storage failures.
  }
};

let latestDraft = "";

export const readDiscountCodeForCheckout = (): string =>
  normalizeDiscountCode(latestDraft) || readStoredCode();

type DiscountCodeFieldProps = {
  compact?: boolean;
  subtotalAud?: number;
};

export function DiscountCodeField({ compact = false, subtotalAud }: DiscountCodeFieldProps) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [applied, setApplied] = useState<AppliedDiscount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const stored = readStoredCode();
    if (!stored) return;
    latestDraft = stored;
    setDraft(stored);
    void applyCode(stored);
    // Re-check today's code once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyCode = async (value: string) => {
    const code = normalizeDiscountCode(value);
    if (!code) {
      latestDraft = "";
      writeStoredCode("");
      setApplied(null);
      setError("Enter the code from the board to apply today’s discount.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/discount/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        code?: string;
        percent_off?: number;
        error?: string;
      };
      if (!response.ok || !body.ok || !body.code || typeof body.percent_off !== "number") {
        writeStoredCode("");
        setApplied(null);
        setError(body.error ?? DISCOUNT_INVALID_MESSAGE);
        return;
      }
      writeStoredCode(body.code);
      latestDraft = body.code;
      setDraft(body.code);
      setApplied({ code: body.code, percent_off: body.percent_off });
    } catch {
      writeStoredCode("");
      setApplied(null);
      setError(DISCOUNT_INVALID_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.wrap}>
      <label className={styles.label} htmlFor={inputId}>
        Exhibition code
      </label>
      {compact ? null : (
        <p className={styles.hint}>If you have today&apos;s code from the board, enter it here.</p>
      )}
      <div className={styles.row}>
        <input
          id={inputId}
          className={styles.input}
          value={draft}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={24}
          placeholder="Code from the board"
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            latestDraft = next;
            setDraft(next);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void applyCode(event.currentTarget.value);
            }
          }}
        />
        <button
          className={`button-outline ${styles.apply}`}
          type="button"
          disabled={busy}
          onClick={(event) => {
            const input = event.currentTarget.parentElement?.querySelector("input");
            void applyCode(input?.value ?? draft);
          }}
        >
          {busy ? "Checking…" : "Apply"}
        </button>
      </div>
      {applied ? (
        <p className={styles.success}>
          {applied.percent_off}% off applied
          {typeof subtotalAud === "number"
            ? ` · save ${formatAUD(discountAmountCents(subtotalAud, applied.percent_off))}`
            : ""}
          .{" "}
          <button
            className={styles.clear}
            type="button"
            onClick={() => {
              latestDraft = "";
              setDraft("");
              setApplied(null);
              setError(null);
              writeStoredCode("");
            }}
          >
            Remove
          </button>
        </p>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
