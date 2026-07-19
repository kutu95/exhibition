"use client";

import { useMemo } from "react";

import {
  computeCustomSizeMm,
  type FitMode,
  type SizeLock,
  type VariantFramingInput,
} from "../../lib/print-framing";
import styles from "./PrintFramingControls.module.css";

type PrintFramingControlsProps = {
  label: string;
  templateWidthMm: number;
  templateHeightMm: number;
  pixelWidth: number | null;
  pixelHeight: number | null;
  previewUrl?: string | null;
  value: VariantFramingInput;
  onChange: (next: VariantFramingInput) => void;
};

const defaultFraming = (): VariantFramingInput => ({
  fit_mode: "cover_crop",
  crop_offset: 0,
  size_lock: null,
});

export const defaultVariantFraming = defaultFraming;

export function PrintFramingControls({
  label,
  templateWidthMm,
  templateHeightMm,
  pixelWidth,
  pixelHeight,
  previewUrl,
  value,
  onChange,
}: PrintFramingControlsProps) {
  const fitMode: FitMode = value.fit_mode === "custom_size" ? "custom_size" : "cover_crop";
  const sizeLock: SizeLock = value.size_lock ?? "long_edge";
  const cropOffset = value.crop_offset;

  const customSize = useMemo(() => {
    if (!pixelWidth || !pixelHeight || pixelWidth <= 0 || pixelHeight <= 0) return null;
    return computeCustomSizeMm(templateWidthMm, templateHeightMm, pixelWidth, pixelHeight, sizeLock);
  }, [templateWidthMm, templateHeightMm, pixelWidth, pixelHeight, sizeLock]);

  const panAxis = useMemo(() => {
    if (!pixelWidth || !pixelHeight || pixelWidth <= 0 || pixelHeight <= 0) return "horizontal" as const;
    const photoAspect = pixelWidth / pixelHeight;
    const frameAspect = templateWidthMm / templateHeightMm;
    // If photo is relatively wider than the frame, we crop horizontally (pan X).
    return photoAspect > frameAspect ? ("horizontal" as const) : ("vertical" as const);
  }, [pixelWidth, pixelHeight, templateWidthMm, templateHeightMm]);

  const objectPosition =
    panAxis === "horizontal"
      ? `${50 + cropOffset * 50}% 50%`
      : `50% ${50 + cropOffset * 50}%`;

  const frameAspect =
    fitMode === "custom_size" && customSize
      ? `${customSize.width_mm} / ${customSize.height_mm}`
      : `${templateWidthMm} / ${templateHeightMm}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <strong>{label}</strong>
        <span className={styles.muted}>
          Template {templateWidthMm}&nbsp;×&nbsp;{templateHeightMm} mm
        </span>
      </div>

      <div className={styles.layout}>
        <div className={styles.previewFrame} style={{ aspectRatio: frameAspect }}>
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              className={styles.previewImage}
              style={
                fitMode === "cover_crop"
                  ? { objectFit: "cover", objectPosition }
                  : { objectFit: "contain", objectPosition: "50% 50%" }
              }
            />
          ) : (
            <div className={styles.previewEmpty}>No preview</div>
          )}
        </div>

        <div className={styles.controls}>
          <label className={styles.radioRow}>
            <input
              type="radio"
              checked={fitMode === "cover_crop"}
              onChange={() =>
                onChange({ fit_mode: "cover_crop", crop_offset: cropOffset, size_lock: null })
              }
            />
            <span>
              <strong>Cover &amp; crop</strong>
              <span className={styles.muted}> Fill the print size; crop overflow</span>
            </span>
          </label>
          <label className={styles.radioRow}>
            <input
              type="radio"
              checked={fitMode === "custom_size"}
              onChange={() =>
                onChange({
                  fit_mode: "custom_size",
                  crop_offset: 0,
                  size_lock: sizeLock || "long_edge",
                })
              }
            />
            <span>
              <strong>Custom size</strong>
              <span className={styles.muted}> Keep whole image; order custom paper</span>
            </span>
          </label>

          {fitMode === "cover_crop" ? (
            <label className={styles.sliderRow}>
              Pan ({panAxis === "horizontal" ? "left ↔ right" : "up ↕ down"})
              <input
                type="range"
                min={-1}
                max={1}
                step={0.01}
                value={cropOffset}
                onChange={(event) =>
                  onChange({
                    fit_mode: "cover_crop",
                    crop_offset: Number.parseFloat(event.target.value),
                    size_lock: null,
                  })
                }
              />
              <span className={styles.muted}>{cropOffset.toFixed(2)}</span>
            </label>
          ) : (
            <div className={styles.lockGroup}>
              <span className={styles.muted}>Lock from template:</span>
              {(
                [
                  ["long_edge", "Long edge"],
                  ["width", "Width"],
                  ["height", "Height"],
                ] as const
              ).map(([lock, lockLabel]) => (
                <label key={lock} className={styles.radioRow}>
                  <input
                    type="radio"
                    checked={sizeLock === lock}
                    onChange={() =>
                      onChange({
                        fit_mode: "custom_size",
                        crop_offset: 0,
                        size_lock: lock,
                      })
                    }
                  />
                  {lockLabel}
                </label>
              ))}
              {customSize ? (
                <p className={styles.computed}>
                  Output: <strong>{customSize.width_mm}&nbsp;×&nbsp;{customSize.height_mm} mm</strong>
                </p>
              ) : (
                <p className={styles.muted}>Master pixel size needed to compute custom mm.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
