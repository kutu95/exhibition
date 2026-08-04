"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import styles from "./FramedPreview.module.css";

export type FramedPreviewStyle = "none" | "standard" | "deluxe";

/**
 * Pixel Perfect face widths (https://pixelperfect.com.au/framing/):
 * - Standard: 20 / 30 / 42mm face (we preview the 20mm option)
 * - Deluxe: 10mm face (slimmer / cleaner — not wider)
 */
export const FRAME_MOULDING_MM: Record<Exclude<FramedPreviewStyle, "none">, number> = {
  standard: 20,
  deluxe: 10,
};

/** Default long edge used when size is unknown (Medium / A2). */
export const FRAME_PREVIEW_DEFAULT_LONG_EDGE_MM = 594;

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

const parseAspectRatio = (value: CSSProperties["aspectRatio"]): number => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.includes("/")) {
      const [a, b] = trimmed.split("/").map((part) => Number.parseFloat(part.trim()));
      if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
    }
    const n = Number.parseFloat(trimmed);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1.5;
};

/**
 * True-to-scale moulding width in CSS px from the preview's border-box width.
 *
 * The preview is width-constrained (`width: 100%`, border-box). Moulding face M
 * and print long-edge L (mm) map to screen as:
 *   landscape (aspect ≥ 1): ring = W × M / (L + 2M)
 *   portrait  (aspect < 1): ring = W × M / (aspect×L + 2M)
 * so ring / printLongEdgePx = M / L.
 */
export function ringPxForPreviewWidth(
  frame: FramedPreviewStyle,
  printLongEdgeMm: number,
  previewWidthPx: number,
  photoAspect: number,
): number {
  if (frame === "none" || previewWidthPx <= 0) return 0;
  const mouldingMm = FRAME_MOULDING_MM[frame];
  const printMm = Math.max(1, printLongEdgeMm);
  const aspect = photoAspect > 0 ? photoAspect : 1.5;
  const denominator =
    aspect >= 1 ? printMm + 2 * mouldingMm : aspect * printMm + 2 * mouldingMm;
  return Math.max(1, Math.round((previewWidthPx * mouldingMm) / denominator));
}

export function FramedPreview({
  frame = "none",
  longEdgeMm = FRAME_PREVIEW_DEFAULT_LONG_EDGE_MM,
  className,
  style,
  children,
}: FramedPreviewProps) {
  const framed = frame !== "none";
  const wrapRef = useRef<HTMLDivElement>(null);
  const [ringPx, setRingPx] = useState(0);

  const { aspectRatio, ...restStyle } = style ?? {};
  const photoAspect = parseAspectRatio(aspectRatio);

  useLayoutEffect(() => {
    if (!framed) {
      setRingPx(0);
      return;
    }
    const node = wrapRef.current;
    if (!node) return;

    const update = () => {
      setRingPx(ringPxForPreviewWidth(frame, longEdgeMm, node.clientWidth, photoAspect));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [frame, framed, longEdgeMm, photoAspect]);

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
      ref={wrapRef}
      className={[styles.wrap, framed ? styles.framed : "", className].filter(Boolean).join(" ")}
      style={wrapStyle}
      data-frame={frame}
    >
      {framed ? <div className={`${styles.ring} ${ringClass}`} aria-hidden /> : null}
      <div className={framed ? styles.mediaFramed : styles.media} style={mediaStyle}>
        {children}
      </div>
    </div>
  );
}
