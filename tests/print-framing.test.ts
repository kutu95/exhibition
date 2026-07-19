import { describe, expect, it } from "vitest";

import { computeCustomSizeMm, resolvePrintSize } from "../lib/print-framing";

describe("print framing", () => {
  it("computes custom size from long edge lock", () => {
    // Template A4 landscape 297x210; square photo → lock long edge 297 as width
    const size = computeCustomSizeMm(297, 210, 4000, 4000, "long_edge");
    expect(size.width_mm).toBe(297);
    expect(size.height_mm).toBe(297);
  });

  it("defaults to cover crop when framing omitted", () => {
    const resolved = resolvePrintSize({
      templateWidthMm: 297,
      templateHeightMm: 210,
      pixelWidth: 4000,
      pixelHeight: 3000,
      framing: null,
    });
    expect(resolved.fit_mode).toBe("cover_crop");
    expect(resolved.width_mm).toBe(297);
    expect(resolved.height_mm).toBe(210);
  });

  it("resolves custom size from master pixels", () => {
    const resolved = resolvePrintSize({
      templateWidthMm: 297,
      templateHeightMm: 210,
      pixelWidth: 3000,
      pixelHeight: 2000,
      framing: { fit_mode: "custom_size", crop_offset: 0, size_lock: "width" },
    });
    expect(resolved.fit_mode).toBe("custom_size");
    expect(resolved.width_mm).toBe(297);
    expect(resolved.height_mm).toBe(198);
  });
});
