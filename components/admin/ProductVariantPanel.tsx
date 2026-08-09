"use client";

import { computeCustomSizeMm, formatMmAspect, type VariantFramingInput } from "../../lib/print-framing";
import type { VariantTemplate } from "../../lib/supabase/types";
import styles from "./ProductEditorForm.module.css";
import { PrintFramingControls } from "./PrintFramingControls";
import { VariantEssentialsControls } from "./VariantEssentialsControls";

export type VariantInput = {
  id?: string;
  has_order_items?: boolean;
  template_id: string;
  variant_label: string;
  price_dollars: string;
  edition_size: string;
  stock_quantity: string;
  stripe_price_id: string;
  width_mm: string;
  height_mm: string;
  border_mm: string;
  paper_type: string;
  print_type: string;
  print_dpi: string;
  source_print_profile_id: string;
  destination_print_profile_id: string;
  tier_label: string;
  finish: string;
  is_framed: boolean;
  frame_type: string;
  lab_cost_dollars: string;
  suggested_retail_min_dollars: string;
  suggested_retail_max_dollars: string;
  turnaround_days_min: string;
  turnaround_days_max: string;
  shipping_class: string;
  fulfilment_notes: string;
  aspect_ratio: string;
  canvas_wrap_mm: string;
  wrap_style: string;
  front_face_width_mm: string;
  front_face_height_mm: string;
  fit_mode: "cover_crop" | "custom_size";
  crop_offset: string;
  size_lock: "" | "long_edge" | "width" | "height";
  is_active: boolean;
};

type ProductVariantPanelProps = {
  variant: VariantInput;
  productType: "print" | "merchandise";
  mode: "new" | "edit";
  masterPixelWidth: number | null;
  masterPixelHeight: number | null;
  masterFilename: string | null;
  previewUrl: string | null;
  activeVariantTemplates: VariantTemplate[];
  creatingTestOrderVariantId: string | null;
  preparingPrintVariantId: string | null;
  printPrepareMessage: string | null;
  onChange: (next: VariantInput) => void;
  onApplyTemplate: (template: VariantTemplate) => void;
  onCreateTestOrder: () => void;
  onPreparePrintFile: () => void;
  onDownloadPrintFile: () => void;
};

export function ProductVariantPanel({
  variant,
  productType,
  mode,
  masterPixelWidth,
  masterPixelHeight,
  masterFilename,
  previewUrl,
  activeVariantTemplates,
  creatingTestOrderVariantId,
  preparingPrintVariantId,
  printPrepareMessage,
  onChange,
  onApplyTemplate,
  onCreateTestOrder,
  onPreparePrintFile,
  onDownloadPrintFile,
}: ProductVariantPanelProps) {
  const templateWidthMm = Number.parseInt(variant.width_mm || "0", 10) || 1;
  const templateHeightMm = Number.parseInt(variant.height_mm || "0", 10) || 1;

  if (productType === "merchandise") {
    return (
      <div className={styles.grid}>
        <label>
          Label
          <input
            value={variant.variant_label}
            onChange={(event) => onChange({ ...variant, variant_label: event.target.value })}
          />
        </label>
        <label>
          Price AUD
          <input
            type="number"
            min="0"
            step="0.01"
            value={variant.price_dollars}
            onChange={(event) => onChange({ ...variant, price_dollars: event.target.value })}
          />
        </label>
        <label>
          Edition size
          <input
            type="number"
            min="1"
            value={variant.edition_size}
            onChange={(event) => onChange({ ...variant, edition_size: event.target.value })}
          />
        </label>
        <label>
          Stock quantity
          <input
            type="number"
            min="0"
            value={variant.stock_quantity}
            onChange={(event) => onChange({ ...variant, stock_quantity: event.target.value })}
          />
        </label>
      </div>
    );
  }

  return (
    <>
      {masterFilename ? (
        <p className={styles.muted}>
          Master TIFF: <code>{masterFilename}</code>
        </p>
      ) : null}

      <VariantEssentialsControls
        value={{
          variant_label: variant.variant_label,
          print_type: variant.print_type || "fine_art",
          paper_type: variant.paper_type,
          width_mm: variant.width_mm,
          height_mm: variant.height_mm,
          aspect_ratio: variant.aspect_ratio,
          price_dollars: variant.price_dollars,
          edition_size: variant.edition_size,
          lab_cost_dollars: variant.lab_cost_dollars,
          tier_label: variant.tier_label,
          fit_mode: variant.fit_mode,
          size_lock: variant.size_lock,
        }}
        masterPixelWidth={masterPixelWidth}
        masterPixelHeight={masterPixelHeight}
        onChange={(essentials) => onChange({ ...variant, ...essentials })}
      />

      {mode === "edit" ? (
        <div className={styles.inlineActions}>
          <button
            className={styles.btnSecondary}
            type="button"
            onClick={onPreparePrintFile}
            disabled={
              !variant.id ||
              !masterFilename ||
              !variant.width_mm ||
              !variant.height_mm ||
              preparingPrintVariantId === variant.id
            }
          >
            {preparingPrintVariantId === variant.id ? "Preparing print file…" : "Prepare print file"}
          </button>
          <button
            className={styles.btnSecondary}
            type="button"
            onClick={onDownloadPrintFile}
            disabled={!variant.id || !variant.width_mm || !variant.height_mm}
          >
            Download TIFF
          </button>
          <button
            className={styles.btnSecondary}
            type="button"
            onClick={onCreateTestOrder}
            disabled={!variant.id || !variant.is_active || creatingTestOrderVariantId === variant.id}
          >
            {creatingTestOrderVariantId === variant.id
              ? "Creating test order..."
              : "Create fulfilment test order"}
          </button>
        </div>
      ) : null}
      {mode === "edit" && printPrepareMessage ? <p className={styles.muted}>{printPrepareMessage}</p> : null}

      <details className={styles.advancedPanel}>
        <summary className={styles.advancedSummary}>
          Optional extras (framing, notes, rare settings)
        </summary>
        <p className={styles.muted}>
          Day-to-day paper prints usually only need the essentials above. Open this when selling framed/canvas
          work, applying an old template, or overriding lab cost.
        </p>
        <div className={styles.grid}>
          <label>
            Apply print template
            <select
              value={variant.template_id}
              onChange={(event) => {
                const template = activeVariantTemplates.find((item) => item.id === event.target.value);
                if (template) onApplyTemplate(template);
                else onChange({ ...variant, template_id: event.target.value });
              }}
            >
              <option value="">None</option>
              {activeVariantTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.variant_label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Stock quantity
            <input
              type="number"
              min="0"
              value={variant.stock_quantity}
              onChange={(event) => onChange({ ...variant, stock_quantity: event.target.value })}
            />
          </label>

          <div className={styles.checkCell}>
            <label>
              <input
                type="checkbox"
                checked={variant.is_framed}
                onChange={(event) => onChange({ ...variant, is_framed: event.target.checked })}
              />
              Framed
            </label>
          </div>
          <label>
            Frame type
            <input
              value={variant.frame_type}
              onChange={(event) => onChange({ ...variant, frame_type: event.target.value })}
              placeholder="e.g. Standard frame"
              disabled={!variant.is_framed}
            />
          </label>

          <label>
            Lab cost AUD
            <input
              type="number"
              min="0"
              step="0.01"
              value={variant.lab_cost_dollars}
              onChange={(event) => onChange({ ...variant, lab_cost_dollars: event.target.value })}
            />
          </label>
          <label>
            Shipping class
            <input
              value={variant.shipping_class}
              onChange={(event) => onChange({ ...variant, shipping_class: event.target.value })}
              placeholder="e.g. flat-large"
            />
          </label>

          <label className={styles.spanFull}>
            Fulfilment notes
            <textarea
              rows={3}
              value={variant.fulfilment_notes}
              onChange={(event) => onChange({ ...variant, fulfilment_notes: event.target.value })}
              placeholder="Copied into the Pixel Perfect order text"
            />
          </label>
        </div>

        <details className={styles.rarePanel}>
          <summary className={styles.rareSummary}>Rare technical settings</summary>
          <div className={styles.grid}>
            <label>
              Width (mm)
              <input
                type="number"
                min="1"
                value={variant.width_mm}
                onChange={(event) => onChange({ ...variant, width_mm: event.target.value })}
              />
            </label>
            <label>
              Height (mm)
              <input
                type="number"
                min="1"
                value={variant.height_mm}
                onChange={(event) => onChange({ ...variant, height_mm: event.target.value })}
              />
            </label>
            <label>
              Border (mm)
              <input
                type="number"
                min="0"
                value={variant.border_mm}
                onChange={(event) => onChange({ ...variant, border_mm: event.target.value })}
              />
            </label>
            <label>
              Print DPI
              <input
                type="number"
                min="1"
                value={variant.print_dpi}
                onChange={(event) => onChange({ ...variant, print_dpi: event.target.value })}
              />
            </label>

            <div className={styles.framingBlock}>
              <PrintFramingControls
                label="Crop to fixed size (advanced)"
                templateWidthMm={templateWidthMm}
                templateHeightMm={templateHeightMm}
                pixelWidth={masterPixelWidth}
                pixelHeight={masterPixelHeight}
                previewUrl={previewUrl}
                value={{
                  fit_mode: variant.fit_mode === "custom_size" ? "custom_size" : "cover_crop",
                  crop_offset: Number.parseFloat(variant.crop_offset || "0") || 0,
                  size_lock:
                    variant.size_lock === "long_edge" ||
                    variant.size_lock === "width" ||
                    variant.size_lock === "height"
                      ? variant.size_lock
                      : null,
                }}
                onChange={(next: VariantFramingInput) => {
                  const updated: VariantInput = {
                    ...variant,
                    fit_mode: next.fit_mode,
                    crop_offset: String(next.crop_offset),
                    size_lock: (next.size_lock ?? "") as VariantInput["size_lock"],
                  };
                  if (
                    next.fit_mode === "custom_size" &&
                    masterPixelWidth &&
                    masterPixelHeight &&
                    next.size_lock
                  ) {
                    const size = computeCustomSizeMm(
                      templateWidthMm,
                      templateHeightMm,
                      masterPixelWidth,
                      masterPixelHeight,
                      next.size_lock,
                    );
                    updated.width_mm = String(size.width_mm);
                    updated.height_mm = String(size.height_mm);
                    updated.aspect_ratio = formatMmAspect(size.width_mm, size.height_mm) ?? "";
                  }
                  onChange(updated);
                }}
              />
            </div>

            <label>
              Finish
              <input
                value={variant.finish}
                onChange={(event) => onChange({ ...variant, finish: event.target.value })}
              />
            </label>
            <label>
              Aspect ratio
              <input
                value={variant.aspect_ratio}
                onChange={(event) => onChange({ ...variant, aspect_ratio: event.target.value })}
              />
            </label>
            <label>
              Suggested retail min AUD
              <input
                type="number"
                min="0"
                step="0.01"
                value={variant.suggested_retail_min_dollars}
                onChange={(event) =>
                  onChange({ ...variant, suggested_retail_min_dollars: event.target.value })
                }
              />
            </label>
            <label>
              Suggested retail max AUD
              <input
                type="number"
                min="0"
                step="0.01"
                value={variant.suggested_retail_max_dollars}
                onChange={(event) =>
                  onChange({ ...variant, suggested_retail_max_dollars: event.target.value })
                }
              />
            </label>
            <label>
              Turnaround days min
              <input
                type="number"
                min="1"
                value={variant.turnaround_days_min}
                onChange={(event) => onChange({ ...variant, turnaround_days_min: event.target.value })}
              />
            </label>
            <label>
              Turnaround days max
              <input
                type="number"
                min="1"
                value={variant.turnaround_days_max}
                onChange={(event) => onChange({ ...variant, turnaround_days_max: event.target.value })}
              />
            </label>
            <label>
              Canvas wrap (mm)
              <input
                type="number"
                min="0"
                value={variant.canvas_wrap_mm}
                onChange={(event) => onChange({ ...variant, canvas_wrap_mm: event.target.value })}
              />
            </label>
            <label>
              Wrap style
              <input
                value={variant.wrap_style}
                onChange={(event) => onChange({ ...variant, wrap_style: event.target.value })}
              />
            </label>
            <label>
              Front face width (mm)
              <input
                type="number"
                min="1"
                value={variant.front_face_width_mm}
                onChange={(event) => onChange({ ...variant, front_face_width_mm: event.target.value })}
              />
            </label>
            <label>
              Front face height (mm)
              <input
                type="number"
                min="1"
                value={variant.front_face_height_mm}
                onChange={(event) => onChange({ ...variant, front_face_height_mm: event.target.value })}
              />
            </label>
            <label>
              Source print profile ID
              <input
                value={variant.source_print_profile_id}
                onChange={(event) => onChange({ ...variant, source_print_profile_id: event.target.value })}
              />
            </label>
            <label>
              Destination print profile ID
              <input
                value={variant.destination_print_profile_id}
                onChange={(event) =>
                  onChange({ ...variant, destination_print_profile_id: event.target.value })
                }
              />
            </label>
          </div>
        </details>
      </details>
    </>
  );
}
