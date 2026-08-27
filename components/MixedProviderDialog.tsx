"use client";

import { MIXED_PROVIDER_MESSAGE } from "../lib/fulfilment";
import styles from "./MixedProviderDialog.module.css";

type MixedProviderDialogProps = {
  open: boolean;
  cartItemCount: number;
  onContinue: () => void;
  onStartSeparate: () => void;
};

export function MixedProviderDialog({
  open,
  cartItemCount,
  onContinue,
  onStartSeparate,
}: MixedProviderDialogProps) {
  if (!open) return null;

  const existing =
    cartItemCount === 1 ? "the print already in it" : `the ${cartItemCount} prints already in it`;

  return (
    <div className={styles.backdrop} role="presentation" onClick={onContinue}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mixed-provider-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="mixed-provider-title">These prints ship separately</h2>
        <p>{MIXED_PROVIDER_MESSAGE}</p>
        <p className={styles.consequence}>
          Starting a new order will empty your cart: {existing} will be removed and replaced with
          this one. Check out first if you want both.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onContinue}>
            Keep my cart
          </button>
          <button type="button" className={styles.primary} onClick={onStartSeparate}>
            Empty cart and add this print
          </button>
        </div>
      </div>
    </div>
  );
}
