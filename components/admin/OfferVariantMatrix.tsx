"use client";

import { useMemo, useState } from "react";

import {
  offerComboKey,
  type OfferSelectionItem,
  type OfferVariantDraft,
} from "../../lib/print-offer";
import { formatDualSize } from "../../lib/print-size";
import styles from "./OfferVariantMatrix.module.css";

const formatMoney = (value: number): string =>
  value.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

const dollarsFromCents = (cents: number): string => (cents / 100).toFixed(2);

export type OfferSelectionState = {
  includedKeys: Set<string>;
  selectedDrafts: OfferVariantDraft[];
  selectionPayload: OfferSelectionItem[];
  pricesValid: boolean;
  toggle: (key: string, included: boolean) => void;
  setPriceDollars: (key: string, dollars: string) => void;
  selectAll: () => void;
  selectNone: () => void;
  selectPosterFactory: () => void;
  selectFineArt: () => void;
  selectCanvas: () => void;
  reset: () => void;
  displayPrice: (draft: OfferVariantDraft) => string;
};

export const useOfferSelection = (drafts: OfferVariantDraft[]): OfferSelectionState => {
  const [includedKeys, setIncludedKeys] = useState<Set<string> | null>(null);
  const [priceByKey, setPriceByKey] = useState<Record<string, string>>({});
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set());

  const allKeys = useMemo(() => drafts.map((draft) => offerComboKey(draft.combo)), [drafts]);
  const included = useMemo(
    () => includedKeys ?? new Set(allKeys),
    [allKeys, includedKeys],
  );

  const selectedDrafts = useMemo(() => {
    return drafts
      .filter((draft) => included.has(offerComboKey(draft.combo)))
      .map((draft) => {
        const key = offerComboKey(draft.combo);
        if (!dirtyKeys.has(key)) return draft;
        const dollars = Number.parseFloat(priceByKey[key] ?? "");
        if (!Number.isFinite(dollars) || dollars < 0) return draft;
        return { ...draft, price_aud: Math.round(dollars * 100) };
      });
  }, [dirtyKeys, drafts, included, priceByKey]);

  const selectionPayload = useMemo(
    (): OfferSelectionItem[] =>
      selectedDrafts.map((draft) => {
        const key = offerComboKey(draft.combo);
        if (dirtyKeys.has(key)) {
          return { ...draft.combo, price_aud: draft.price_aud };
        }
        return { ...draft.combo };
      }),
    [dirtyKeys, selectedDrafts],
  );

  const pricesValid = selectedDrafts.length > 0 && selectedDrafts.every((draft) => {
    const key = offerComboKey(draft.combo);
    if (!dirtyKeys.has(key)) return draft.price_aud >= 0;
    const dollars = Number.parseFloat(priceByKey[key] ?? "");
    return Number.isFinite(dollars) && dollars >= 0;
  });

  const displayPrice = (draft: OfferVariantDraft): string => {
    const key = offerComboKey(draft.combo);
    if (dirtyKeys.has(key) && Object.prototype.hasOwnProperty.call(priceByKey, key)) {
      return priceByKey[key] ?? "";
    }
    return dollarsFromCents(draft.price_aud);
  };

  return {
    includedKeys: included,
    selectedDrafts,
    selectionPayload,
    pricesValid,
    toggle: (key, nextIncluded) => {
      setIncludedKeys((current) => {
        const next = new Set(current ?? allKeys);
        if (nextIncluded) next.add(key);
        else next.delete(key);
        return next;
      });
    },
    setPriceDollars: (key, dollars) => {
      setDirtyKeys((current) => new Set(current).add(key));
      setPriceByKey((current) => ({ ...current, [key]: dollars }));
    },
    selectAll: () => setIncludedKeys(new Set(allKeys)),
    selectNone: () => setIncludedKeys(new Set()),
    selectPosterFactory: () =>
      setIncludedKeys(
        new Set(
          drafts
            .filter((draft) => draft.combo.classId === "photographic" || draft.combo.classId === "framed")
            .map((draft) => offerComboKey(draft.combo)),
        ),
      ),
    selectFineArt: () =>
      setIncludedKeys(
        new Set(
          drafts
            .filter((draft) => draft.combo.classId === "fine_art")
            .map((draft) => offerComboKey(draft.combo)),
        ),
      ),
    selectCanvas: () =>
      setIncludedKeys(
        new Set(
          drafts
            .filter((draft) => draft.combo.classId === "canvas")
            .map((draft) => offerComboKey(draft.combo)),
        ),
      ),
    reset: () => {
      setIncludedKeys(null);
      setPriceByKey({});
      setDirtyKeys(new Set());
    },
    displayPrice,
  };
};

type OfferVariantMatrixProps = {
  drafts: OfferVariantDraft[];
  selection: OfferSelectionState;
};

export function OfferVariantMatrix({ drafts, selection }: OfferVariantMatrixProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <h3>Variants to create ({selection.selectedDrafts.length} of {drafts.length})</h3>
        <div className={styles.actions}>
          <button type="button" onClick={selection.selectAll}>
            All
          </button>
          <button type="button" onClick={selection.selectNone}>
            None
          </button>
          <button type="button" onClick={selection.selectPosterFactory}>
            PosterFactory
          </button>
          <button type="button" onClick={selection.selectFineArt}>
            Fine Art
          </button>
          <button type="button" onClick={selection.selectCanvas}>
            Canvas
          </button>
        </div>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.includeCol}>Include</th>
            <th>Option</th>
            <th>Lab / supplier</th>
            <th>Size</th>
            <th>Supplier cost</th>
            <th>Retail (AUD)</th>
          </tr>
        </thead>
        <tbody>
          {drafts.map((draft) => {
            const key = offerComboKey(draft.combo);
            const included = selection.includedKeys.has(key);
            return (
              <tr key={key} className={included ? undefined : styles.rowOff}>
                <td>
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={(event) => selection.toggle(key, event.target.checked)}
                    aria-label={`Include ${draft.variant_label}`}
                  />
                </td>
                <td>{draft.variant_label}</td>
                <td>{draft.fulfilment_provider === "posterfactory" ? "PosterFactory" : "Pixel Perfect"}</td>
                <td>{formatDualSize(draft.width_mm, draft.height_mm)}</td>
                <td>{formatMoney(draft.lab_cost_aud / 100)}</td>
                <td>
                  <input
                    className={styles.priceInput}
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={!included}
                    value={selection.displayPrice(draft)}
                    onChange={(event) => selection.setPriceDollars(key, event.target.value)}
                    aria-label={`Retail price for ${draft.variant_label}`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {selection.selectedDrafts.length === 0 ? (
        <p className={styles.hint}>Select at least one option to continue.</p>
      ) : null}
    </div>
  );
}
