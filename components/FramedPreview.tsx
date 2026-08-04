"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";

import {
  DELUXE_FRAME_FACE_MM,
  STANDARD_FRAME_FACE_MM,
} from "../lib/print-frame-styles";
import styles from "./FramedPreview.module.css";

export type FramedPreviewStyle = "none" | "standard" | "deluxe";

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
 * (No ResizeObserver — measuring outer width created a soft plateau near ~550mm.)
 */
export const FRAME_PREVIEW_PHOTO_LONG_EDGE_PX = 520;

type FramedPreviewProps = {
  frame?: FramedPreviewStyle;
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

  const { aspectRatio, ...restStyle } = style ?? {};

  const ringClass =
    frame === "standard" ? styles.ringStandard : frame === "deluxe" ? styles.ringDeluxe : "";

  const wrapStyle: CSSProperties | undefined = framed
    ? {
        ...restStyle,
        aspectRatio: "auto",
        ["--ring" as string]: `${ringPx}px`,
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
      data-ring-px={framed ? ringPx : undefined}
      data-long-edge-mm={framed ? longEdgeMm : undefined}
    >
      {framed ? <div className={`${styles.ring} ${ringClass}`} aria-hidden /> : null}
      <div className={framed ? styles.mediaFramed : styles.media} style={mediaStyle}>
        {children}
      </div>
    </div>
  );
}
