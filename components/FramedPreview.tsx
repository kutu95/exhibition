import type { CSSProperties, ReactNode } from "react";

import styles from "./FramedPreview.module.css";

export type FramedPreviewStyle = "none" | "standard" | "deluxe";

type FramedPreviewProps = {
  frame?: FramedPreviewStyle;
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

export function FramedPreview({
  frame = "none",
  className,
  style,
  children,
}: FramedPreviewProps) {
  const framed = frame !== "none";
  const frameClass =
    frame === "standard" ? styles.standard : frame === "deluxe" ? styles.deluxe : "";

  return (
    <div
      className={[styles.wrap, framed ? styles.framed : "", frameClass, className]
        .filter(Boolean)
        .join(" ")}
      style={style}
      data-frame={frame}
    >
      <div className={styles.media}>{children}</div>
    </div>
  );
}
