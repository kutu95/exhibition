export type FitMode = "cover_crop" | "custom_size";
export type SizeLock = "long_edge" | "width" | "height";

export type VariantFramingInput = {
  fit_mode: FitMode;
  crop_offset: number;
  size_lock: SizeLock | null;
};

export type ResolvedPrintSize = {
  width_mm: number;
  height_mm: number;
  fit_mode: FitMode;
  crop_offset: number;
  size_lock: SizeLock | null;
  aspect_ratio: string | null;
};

export const clampCropOffset = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(-1, value));
};

export const masterAspectRatio = (pixelWidth: number, pixelHeight: number): number => {
  if (pixelWidth <= 0 || pixelHeight <= 0) {
    throw new Error("Master pixel dimensions must be positive.");
  }
  return pixelWidth / pixelHeight;
};

/**
 * Compute custom paper size by locking one edge from the template and
 * deriving the other from the master photo aspect ratio.
 */
export const computeCustomSizeMm = (
  templateWidthMm: number,
  templateHeightMm: number,
  pixelWidth: number,
  pixelHeight: number,
  sizeLock: SizeLock = "long_edge",
): { width_mm: number; height_mm: number } => {
  const aspect = masterAspectRatio(pixelWidth, pixelHeight);
  const lock = sizeLock;

  if (lock === "width") {
    const width_mm = Math.round(templateWidthMm);
    const height_mm = Math.max(1, Math.round(width_mm / aspect));
    return { width_mm, height_mm };
  }

  if (lock === "height") {
    const height_mm = Math.round(templateHeightMm);
    const width_mm = Math.max(1, Math.round(height_mm * aspect));
    return { width_mm, height_mm };
  }

  // long_edge: keep the longer template edge, derive the other from photo aspect
  const templateIsLandscape = templateWidthMm >= templateHeightMm;
  const photoIsLandscape = aspect >= 1;

  if (templateIsLandscape) {
    const longEdge = Math.max(templateWidthMm, templateHeightMm);
    if (photoIsLandscape) {
      const width_mm = Math.round(longEdge);
      const height_mm = Math.max(1, Math.round(width_mm / aspect));
      return { width_mm, height_mm };
    }
    // Photo is portrait: long edge becomes height
    const height_mm = Math.round(longEdge);
    const width_mm = Math.max(1, Math.round(height_mm * aspect));
    return { width_mm, height_mm };
  }

  const longEdge = Math.max(templateWidthMm, templateHeightMm);
  if (photoIsLandscape) {
    const width_mm = Math.round(longEdge);
    const height_mm = Math.max(1, Math.round(width_mm / aspect));
    return { width_mm, height_mm };
  }
  const height_mm = Math.round(longEdge);
  const width_mm = Math.max(1, Math.round(height_mm * aspect));
  return { width_mm, height_mm };
};

export const formatMmAspect = (widthMm: number, heightMm: number): string | null => {
  if (widthMm <= 0 || heightMm <= 0) return null;
  return `${(widthMm / heightMm).toFixed(3)}:1`;
};

export const resolvePrintSize = (args: {
  templateWidthMm: number;
  templateHeightMm: number;
  pixelWidth: number | null;
  pixelHeight: number | null;
  framing?: Partial<VariantFramingInput> | null;
}): ResolvedPrintSize => {
  const fitMode: FitMode = args.framing?.fit_mode === "custom_size" ? "custom_size" : "cover_crop";
  const cropOffset = clampCropOffset(args.framing?.crop_offset ?? 0);
  const sizeLock: SizeLock | null =
    fitMode === "custom_size" ? args.framing?.size_lock ?? "long_edge" : null;

  if (
    fitMode === "custom_size" &&
    args.pixelWidth &&
    args.pixelHeight &&
    args.pixelWidth > 0 &&
    args.pixelHeight > 0
  ) {
    const size = computeCustomSizeMm(
      args.templateWidthMm,
      args.templateHeightMm,
      args.pixelWidth,
      args.pixelHeight,
      sizeLock ?? "long_edge",
    );
    return {
      ...size,
      fit_mode: fitMode,
      crop_offset: 0,
      size_lock: sizeLock,
      aspect_ratio: formatMmAspect(size.width_mm, size.height_mm),
    };
  }

  return {
    width_mm: Math.round(args.templateWidthMm),
    height_mm: Math.round(args.templateHeightMm),
    fit_mode: "cover_crop",
    crop_offset: cropOffset,
    size_lock: null,
    aspect_ratio: formatMmAspect(args.templateWidthMm, args.templateHeightMm),
  };
};

export const describeFramingNote = (
  templateLabel: string,
  resolved: ResolvedPrintSize,
): string => {
  if (resolved.fit_mode === "custom_size") {
    return `Custom size ${resolved.width_mm}x${resolved.height_mm}mm based on ${templateLabel} (lock ${resolved.size_lock ?? "long_edge"}).`;
  }
  if (resolved.crop_offset !== 0) {
    return `Cover crop of ${templateLabel}; pan offset ${resolved.crop_offset.toFixed(2)}.`;
  }
  return `Cover crop of ${templateLabel}.`;
};
