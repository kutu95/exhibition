"use client";

import { useEffect, useMemo, useState } from "react";

import {
  formatCustomSizeVariantLabel,
  LONG_EDGE_PRESETS,
  OTHER_PAPER_ID,
  type ManagedPaper,
  type PrintTypeCode,
  paperLabelFromSelect,
  paperSelectValue,
  papersForPrintType,
  PRINT_TYPES,
  seedManagedPapers,
  suggestTierForLongEdge,
  tierGuidance,
  TIER_OPTIONS,
} from "../../lib/print-catalogue";
import { DEFAULT_PRINT_PRICE_MARKUP_FACTOR } from "../../lib/print-markup";
import {
  computeMarginGuidance,
  computeRetailFromLabCost,
  deriveAspectPreservingSizeMm,
  estimatePixelPerfectLabCost,
  formatDualSize,
  formatPhotoAspectSummary,
  longEdgeInputToMm,
  longEdgeMmToInput,
  type SizeUnit,
} from "../../lib/print-size";
import styles from "./VariantEssentialsControls.module.css";

export type VariantEssentialsValue = {
  variant_label: string;
  print_type: string;
  paper_type: string;
  width_mm: string;
  height_mm: string;
  aspect_ratio: string;
  price_dollars: string;
  edition_size: string;
  lab_cost_dollars: string;
  tier_label: string;
  fit_mode: "cover_crop" | "custom_size";
  size_lock: "" | "long_edge" | "width" | "height";
};

type VariantEssentialsControlsProps = {
  value: VariantEssentialsValue;
  masterPixelWidth: number | null;
  masterPixelHeight: number | null;
  markupFactor?: number;
  onChange: (next: VariantEssentialsValue) => void;
};

const parseLongEdge = (widthMm: string, heightMm: string): number =>
  Math.max(Number.parseInt(widthMm || "0", 10) || 0, Number.parseInt(heightMm || "0", 10) || 0);

const formatMoney = (value: number): string =>
  value.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

export function VariantEssentialsControls({
  value,
  masterPixelWidth,
  masterPixelHeight,
  markupFactor: markupFactorProp = DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
  onChange,
}: VariantEssentialsControlsProps) {
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>("mm");
  const [preferCustomSize, setPreferCustomSize] = useState(false);
  const [markupFactor, setMarkupFactor] = useState(markupFactorProp);
  const [basePriceAud, setBasePriceAud] = useState(0);
  const [papers, setPapers] = useState<ManagedPaper[]>(() => seedManagedPapers());
  const printType = (value.print_type || "fine_art") as PrintTypeCode;
  const paperOptions = useMemo(() => papersForPrintType(printType, papers), [papers, printType]);
  const paperSelect = paperSelectValue(value.paper_type, papers);
  const customPaper = paperSelect === OTHER_PAPER_ID ? value.paper_type : "";
  const aspectSummary = formatPhotoAspectSummary(masterPixelWidth, masterPixelHeight);
  const hasMasterPixels = Boolean(masterPixelWidth && masterPixelHeight && masterPixelWidth > 0 && masterPixelHeight > 0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/print-pricing/markup");
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as {
          markup_factor?: number;
          base_price_aud?: number;
          papers?: ManagedPaper[];
        };
        if (!cancelled) {
          if (typeof body.markup_factor === "number") setMarkupFactor(body.markup_factor);
          if (typeof body.base_price_aud === "number") setBasePriceAud(body.base_price_aud);
          if (Array.isArray(body.papers) && body.papers.length > 0) setPapers(body.papers);
        }
      } catch {
        // Keep prop / default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMarkupFactor(markupFactorProp);
  }, [markupFactorProp]);

  const widthMm = Number.parseInt(value.width_mm || "0", 10) || 0;
  const heightMm = Number.parseInt(value.height_mm || "0", 10) || 0;
  const longEdgeMm = parseLongEdge(value.width_mm, value.height_mm);
  const matchesPreset = LONG_EDGE_PRESETS.some((preset) => preset.mm === longEdgeMm) && longEdgeMm > 0;
  const longEdgeSelect =
    preferCustomSize || (longEdgeMm > 0 && !matchesPreset)
      ? "custom"
      : matchesPreset
        ? String(longEdgeMm)
        : "";

  const labEstimate = useMemo(
    () =>
      widthMm > 0 && heightMm > 0
        ? estimatePixelPerfectLabCost(widthMm, heightMm, value.paper_type, papers)
        : null,
    [papers, widthMm, heightMm, value.paper_type],
  );

  const retailAud = Number.parseFloat(value.price_dollars || "");
  const margin = useMemo(() => {
    if (!labEstimate || !Number.isFinite(retailAud)) return null;
    return computeMarginGuidance(retailAud, labEstimate.labCostAud);
  }, [labEstimate, retailAud]);

  const withLabCost = (next: VariantEssentialsValue): VariantEssentialsValue => {
    const nextWidth = Number.parseInt(next.width_mm || "0", 10) || 0;
    const nextHeight = Number.parseInt(next.height_mm || "0", 10) || 0;
    if (nextWidth <= 0 || nextHeight <= 0 || !next.paper_type.trim()) return next;
    const estimate = estimatePixelPerfectLabCost(nextWidth, nextHeight, next.paper_type, papers);
    if (!estimate) return next;
    return { ...next, lab_cost_dollars: estimate.labCostAud.toFixed(2) };
  };

  const applySizeFromLongEdge = (nextLongEdgeMm: number) => {
    if (!hasMasterPixels || nextLongEdgeMm <= 0) return;
    const size = deriveAspectPreservingSizeMm(nextLongEdgeMm, masterPixelWidth!, masterPixelHeight!);
    const paper = value.paper_type.trim();
    const suggestedTier = suggestTierForLongEdge(
      Math.max(size.width_mm, size.height_mm),
      (value.print_type || "fine_art") as PrintTypeCode,
    );
    onChange(
      withLabCost({
        ...value,
        width_mm: String(size.width_mm),
        height_mm: String(size.height_mm),
        aspect_ratio: size.aspect_ratio ?? "",
        fit_mode: "custom_size",
        size_lock: "long_edge",
        tier_label: value.tier_label.trim() || suggestedTier,
        variant_label: value.variant_label.trim()
          ? value.variant_label
          : formatCustomSizeVariantLabel({
              paperLabel: paper,
              widthMm: size.width_mm,
              heightMm: size.height_mm,
              longEdgeMm: nextLongEdgeMm,
            }),
      }),
    );
  };

  const applyPaper = (selectValue: string, nextCustomPaper = customPaper) => {
    const paper = paperLabelFromSelect(selectValue, nextCustomPaper, papers);
    const width = Number.parseInt(value.width_mm || "0", 10);
    const height = Number.parseInt(value.height_mm || "0", 10);
    const nextLabel =
      width > 0 && height > 0 && paper
        ? formatCustomSizeVariantLabel({
            paperLabel: paper,
            widthMm: width,
            heightMm: height,
            longEdgeMm: Math.max(width, height),
          })
        : value.variant_label;
    onChange(withLabCost({ ...value, paper_type: paper, variant_label: nextLabel }));
  };

  const applyFormulaPrice = () => {
    if (!labEstimate) return;
    const retail = computeRetailFromLabCost(labEstimate.labCostAud, markupFactor, basePriceAud);
    onChange({ ...value, price_dollars: retail.toFixed(2), lab_cost_dollars: labEstimate.labCostAud.toFixed(2) });
  };

  return (
    <div className={styles.wrap}>
      {aspectSummary ? (
        <p className={styles.aspectBanner}>Master photo: {aspectSummary}</p>
      ) : (
        <p className={styles.warning}>
          Master TIFF dimensions unavailable — enter width and height manually under Advanced, or register this photo
          from a master file first.
        </p>
      )}

      <div className={styles.unitToggle} role="group" aria-label="Size units">
        <span className={styles.unitLabel}>Size units</span>
        <button
          type="button"
          className={sizeUnit === "mm" ? styles.unitActive : styles.unitBtn}
          onClick={() => setSizeUnit("mm")}
        >
          mm
        </button>
        <button
          type="button"
          className={sizeUnit === "in" ? styles.unitActive : styles.unitBtn}
          onClick={() => setSizeUnit("in")}
        >
          inches
        </button>
      </div>

      <div className={styles.grid}>
        <label>
          Print type
          <select
            value={printType}
              onChange={(event) => {
              const nextPrintType = event.target.value as PrintTypeCode;
              const nextPapers = papersForPrintType(nextPrintType, papers);
              const nextPaper = nextPapers[0]?.label ?? "";
              const width = Number.parseInt(value.width_mm || "0", 10) || 0;
              const height = Number.parseInt(value.height_mm || "0", 10) || 0;
              onChange(
                withLabCost({
                  ...value,
                  print_type: nextPrintType,
                  paper_type: nextPaper,
                  variant_label:
                    width > 0 && height > 0 && nextPaper
                      ? formatCustomSizeVariantLabel({
                          paperLabel: nextPaper,
                          widthMm: width,
                          heightMm: height,
                          longEdgeMm: Math.max(width, height),
                        })
                      : value.variant_label,
                }),
              );
            }}
          >
            {PRINT_TYPES.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Paper
          <select
            value={paperSelect || (paperOptions[0]?.id ?? "")}
            onChange={(event) => applyPaper(event.target.value)}
          >
            {paperOptions.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.label}
              </option>
            ))}
            <option value={OTHER_PAPER_ID}>Other (custom)</option>
          </select>
        </label>

        {(paperSelect === OTHER_PAPER_ID || !paperSelect) && (
          <label className={styles.spanFull}>
            Custom paper name
            <input
              value={customPaper}
              onChange={(event) => applyPaper(OTHER_PAPER_ID, event.target.value)}
              placeholder="Paper name as ordered from the lab"
            />
          </label>
        )}

        <label>
          Print size (long edge)
          <select
            value={longEdgeSelect}
            disabled={!hasMasterPixels}
            onChange={(event) => {
              const selected = event.target.value;
              if (selected === "custom") {
                setPreferCustomSize(true);
                return;
              }
              setPreferCustomSize(false);
              applySizeFromLongEdge(Number.parseInt(selected, 10));
            }}
          >
            <option value="">Select size…</option>
            {LONG_EDGE_PRESETS.map((preset) => (
              <option key={preset.mm} value={String(preset.mm)}>
                {sizeUnit === "mm" ? preset.labelMm : preset.labelIn}
              </option>
            ))}
            <option value="custom">Custom long edge</option>
          </select>
        </label>

        {longEdgeSelect === "custom" && hasMasterPixels ? (
          <label>
            Custom long edge ({sizeUnit})
            <input
              type="number"
              min="0.1"
              step={sizeUnit === "mm" ? "1" : "0.1"}
              value={longEdgeMm > 0 ? longEdgeMmToInput(longEdgeMm, sizeUnit) : ""}
              onChange={(event) => {
                const next = Number.parseFloat(event.target.value || "0");
                const nextMm = longEdgeInputToMm(next, sizeUnit);
                if (nextMm > 0) applySizeFromLongEdge(nextMm);
              }}
            />
          </label>
        ) : null}

        <label className={styles.readOnly}>
          Output size
          <output className={styles.output}>
            {widthMm > 0 && heightMm > 0 ? formatDualSize(widthMm, heightMm) : "—"}
          </output>
        </label>

        <label>
          Label
          <input
            value={value.variant_label}
            onChange={(event) => onChange({ ...value, variant_label: event.target.value })}
          />
        </label>

        <label>
          Price AUD
          <input
            type="number"
            min="0"
            step="0.01"
            value={value.price_dollars}
            onChange={(event) => onChange({ ...value, price_dollars: event.target.value })}
          />
          {labEstimate ? (
            <button type="button" className={styles.formulaButton} onClick={applyFormulaPrice}>
              Apply formula price (rounded)
            </button>
          ) : null}
        </label>

        <label>
          Edition size
          <input
            type="number"
            min="1"
            value={value.edition_size}
            onChange={(event) => onChange({ ...value, edition_size: event.target.value })}
          />
        </label>

        <label className={styles.spanFull}>
          Range tier
          <select
            value={value.tier_label}
            onChange={(event) => onChange({ ...value, tier_label: event.target.value })}
          >
            <option value="">Select tier…</option>
            {TIER_OPTIONS.map((tier) => (
              <option key={tier.id} value={tier.label}>
                {tier.label}
              </option>
            ))}
          </select>
          <span className={styles.fieldHint}>
            {tierGuidance(value.tier_label) ??
              "Shown as “Range” on the fulfilment dashboard when ordering from Pixel Perfect. Pick by intended wall size / positioning, not paper."}
          </span>
        </label>
      </div>

      {labEstimate ? (
        <div className={styles.marginPanel}>
          <p className={styles.marginTitle}>Pixel Perfect cost guidance</p>
          <p className={styles.marginRow}>
            Est. lab cost <strong>{formatMoney(labEstimate.labCostAud)}</strong>
            <span className={styles.marginMeta}>
              {labEstimate.areaSqIn} sq in × {formatMoney(labEstimate.ratePerSqInAud)}/sq in
            </span>
          </p>
          {margin ? (
            <p className={styles.marginRow}>
              Margin{" "}
              <strong className={margin.marginAud < 0 ? styles.marginNegative : undefined}>
                {formatMoney(margin.marginAud)}
                {margin.marginPercent !== null ? ` (${margin.marginPercent}%)` : ""}
              </strong>
              {value.price_dollars ? (
                <span className={styles.marginMeta}>
                  retail {formatMoney(retailAud)} − lab {formatMoney(labEstimate.labCostAud)}
                </span>
              ) : null}
            </p>
          ) : (
            <p className={styles.marginMeta}>Enter a retail price to see margin.</p>
          )}
          <p className={styles.marginNote}>
            {labEstimate.note}. Lab cost uses this paper&apos;s $/sq in from Print Templates. Formula: roundUp(base $
            {basePriceAud.toFixed(2)} + {markupFactor}× lab) — $5 under $120, $10 at $120+.
          </p>
        </div>
      ) : paperSelect === OTHER_PAPER_ID || value.print_type === "metal" ? (
        <p className={styles.warning}>
          No automatic Pixel Perfect rate for this paper — enter Lab Cost under Advanced if you have a quote.
        </p>
      ) : null}
    </div>
  );
}
