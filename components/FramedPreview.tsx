"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";

import {
  DELUXE_FRAME_FACE_MM,
  STANDARD_FRAME_FACE_MM,
} from "../lib/print-frame-styles";
import styles from "./FramedPreview.module.css";

export type FramedPreviewStyle = "none" | "standard" | "deluxe";
export type FrameColourId = "black" | "silver" | "teak" | "gold" | "white" | "timber";

/**
 * Face widths for virtual preview — matches Pixel Perfect
 * https://pixelperfect.com.au/framing/
 */
export const FRAME_MOULDING_MM: Record<Exclude<FramedPreviewStyle, "none">, number> = {
  standard: STANDARD_FRAME_FACE_MM,
  deluxe: DELUXE_FRAME_FACE_MM,
};

/** Default long edge used when size is unknown (Medium / A2). */
export const FRAME_PREVIEW_DEFAULT_LONG_EDGE_MM = 594;

/**
 * On-screen length we treat as the print’s long edge. The preview photo is
 * roughly this size; moulding px = faceMm / printLongMm × this value.
 */
export const FRAME_PREVIEW_PHOTO_LONG_EDGE_PX = 520;

/**
 * Preview-only mat width (mm each side). Not included in fulfilment —
 * visual finish between photo and moulding.
 */
export const FRAME_PREVIEW_MAT_MM = 40;

type FramedPreviewProps = {
  frame?: FramedPreviewStyle;
  frameColour?: FrameColourId;
  /** Print long edge in mm — scales moulding so small prints look thicker-framed. */
  longEdgeMm?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
};

export function mapOfferPresentationToFrame(
  presentationId: "unframed" | "framed" | string,
): FramedPreviewStyle {
  return presentationId === "framed" ? "standard" : "none";
}

export function mapCustomFrameToPreview(
  frameStyle: "none" | "standard_perspex" | "deluxe_perspex" | string,
): FramedPreviewStyle {
  if (frameStyle === "standard_perspex") return "standard";
  if (frameStyle === "deluxe_perspex") return "deluxe";
  return "none";
}

/**
 * True-to-scale moulding width in CSS px.
 * ring / photoLongPx = mouldingMm / printLongMm (no px cap).
 */
export function ringPxForPrintLongEdge(
  frame: FramedPreviewStyle,
  printLongEdgeMm: number,
  photoLongEdgePx: number = FRAME_PREVIEW_PHOTO_LONG_EDGE_PX,
): number {
  if (frame === "none" || photoLongEdgePx <= 0) return 0;
  const printMm = Math.max(1, printLongEdgeMm);
  return Math.max(1, Math.round((FRAME_MOULDING_MM[frame] / printMm) * photoLongEdgePx));
}

/** Preview-only mat thickness in CSS px (scales with print long-edge). */
export function matPxForPrintLongEdge(
  printLongEdgeMm: number,
  photoLongEdgePx: number = FRAME_PREVIEW_PHOTO_LONG_EDGE_PX,
): number {
  const printMm = Math.max(1, printLongEdgeMm);
  const raw = Math.round((FRAME_PREVIEW_MAT_MM / printMm) * photoLongEdgePx);
  return Math.min(56, Math.max(8, raw));
}

/** @deprecated Use ringPxForPrintLongEdge */
export function ringPxForPreviewWidth(
  frame: FramedPreviewStyle,
  printLongEdgeMm: number,
  _previewWidthPx: number,
  _photoAspect: number,
): number {
  return ringPxForPrintLongEdge(frame, printLongEdgeMm);
}

export function FramedPreview({
  frame = "none",
  frameColour = "black",
  longEdgeMm = FRAME_PREVIEW_DEFAULT_LONG_EDGE_MM,
  className,
  style,
  children,
}: FramedPreviewProps) {
  const framed = frame !== "none";
  const ringPx = useMemo(
    () => (framed ? ringPxForPrintLongEdge(frame, longEdgeMm) : 0),
    [frame, framed, longEdgeMm],
  );
  const matPx = useMemo(
    () => (framed ? matPxForPrintLongEdge(longEdgeMm) : 0),
    [framed, longEdgeMm],
  );

  const { aspectRatio, ...restStyle } = style ?? {};

  const ringClass =
    frame === "standard" ? styles.ringStandard : frame === "deluxe" ? styles.ringDeluxe : "";

  const wrapStyle: CSSProperties | undefined = framed
    ? {
        ...restStyle,
        aspectRatio: "auto",
        ["--ring" as string]: `${ringPx}px`,
        ["--mat" as string]: `${matPx}px`,
      }
    : style;
  const mediaStyle: CSSProperties | undefined = framed
    ? { aspectRatio: aspectRatio ?? "3 / 2" }
    : undefined;

  return (
    <div
      className={[styles.wrap, framed ? styles.framed : "", className].filter(Boolean).join(" ")}
      style={wrapStyle}
      data-frame={frame}
      data-frame-colour={frameColour}
      data-ring-px={framed ? ringPx : undefined}
      data-mat-px={framed ? matPx : undefined}
      data-long-edge-mm={framed ? longEdgeMm : undefined}
    >
      {framed ? <div className={`${styles.ring} ${ringClass}`} aria-hidden /> : null}
      {framed ? (
        <div className={styles.mat}>
          <div className={styles.mediaFramed} style={mediaStyle}>
            {children}
          </div>
        </div>
      ) : (
        <div className={styles.media}>{children}</div>
      )}
    </div>
  );
}
