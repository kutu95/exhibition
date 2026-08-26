"use client";

import { MIXED_PROVIDER_MESSAGE } from "../lib/fulfilment";
import styles from "./StudioOrderDestinationDialog.module.css";

type MixedProviderDialogProps = {
  open: boolean;
  onContinue: () => void;
  onStartSeparate: () => void;
};

export function MixedProviderDialog({ open, onContinue, onStartSeparate }: MixedProviderDialogProps) {
  if (!open) return null;

  return (
    <div className={styles.backdrop} role="presentation" onClick={onContinue}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mixed-provider-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="mixed-provider-title">Order these prints separately</h2>
        <p>{MIXED_PROVIDER_MESSAGE}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onContinue}>
            Continue with current cart
          </button>
          <button type="button" className={styles.primary} onClick={onStartSeparate}>
            Start a separate order
          </button>
        </div>
      </div>
    </div>
  );
}
