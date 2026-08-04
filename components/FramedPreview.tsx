import type { CSSProperties, ReactNode } from "react";

import styles from "./FramedPreview.module.css";

export type FramedPreviewStyle = "none" | "standard" | "deluxe";

/** Approximate moulding face width (mm) — fixed in the real world. */
export const FRAME_MOULDING_MM: Record<Exclude<FramedPreviewStyle, "none">, number> = {
  standard: 20,
  deluxe: 38,
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

export function mouldingRatioForPreview(
  frame: FramedPreviewStyle,
  longEdgeMm: number = FRAME_PREVIEW_DEFAULT_LONG_EDGE_MM,
): number {
  if (frame === "none") return 0;
  const edge = Math.max(120, longEdgeMm);
  return FRAME_MOULDING_MM[frame] / edge;
}

export function FramedPreview({
  frame = "none",
  longEdgeMm = FRAME_PREVIEW_DEFAULT_LONG_EDGE_MM,
  className,
  style,
  children,
}: FramedPreviewProps) {
  const framed = frame !== "none";
  const ringClass =
    frame === "standard" ? styles.ringStandard : frame === "deluxe" ? styles.ringDeluxe : "";
  const ratio = mouldingRatioForPreview(frame, longEdgeMm);

  const mergedStyle: CSSProperties | undefined = framed
    ? {
        ...style,
        ["--moulding-ratio" as string]: String(ratio),
      }
    : style;

  return (
    <div
      className={[styles.wrap, framed ? styles.framed : "", className].filter(Boolean).join(" ")}
      style={mergedStyle}
      data-frame={frame}
    >
      {framed ? <div className={`${styles.ring} ${ringClass}`} aria-hidden /> : null}
      <div className={styles.media}>{children}</div>
    </div>
  );
}
