import { describe, expect, it } from "vitest";

import { FRAME_MOULDING_MM, ringPxForPreviewWidth } from "../components/FramedPreview";

describe("ringPxForPreviewWidth", () => {
  it("keeps moulding / print long-edge ratio on landscape previews", () => {
    const width = 600;
    const printLong = 594;
    const aspect = 1.5;
    const ring = ringPxForPreviewWidth("standard", printLong, width, aspect);
    const mediaLong = width - 2 * ring;
    expect(ring / mediaLong).toBeCloseTo(FRAME_MOULDING_MM.standard / printLong, 2);
  });

  it("keeps moulding / print long-edge ratio on portrait previews", () => {
    const width = 400;
    const printLong = 594;
    const aspect = 2 / 3;
    const ring = ringPxForPreviewWidth("standard", printLong, width, aspect);
    const mediaShort = width - 2 * ring;
    const mediaLong = mediaShort / aspect;
    expect(ring / mediaLong).toBeCloseTo(FRAME_MOULDING_MM.standard / printLong, 2);
  });

  it("renders Deluxe half as thick as Standard (10mm vs 20mm)", () => {
    const width = 600;
    const standard = ringPxForPreviewWidth("standard", 594, width, 1.5);
    const deluxe = ringPxForPreviewWidth("deluxe", 594, width, 1.5);
    expect(FRAME_MOULDING_MM.deluxe).toBe(10);
    expect(FRAME_MOULDING_MM.standard).toBe(20);
    expect(deluxe).toBeLessThan(standard);
    expect(deluxe / standard).toBeCloseTo(0.5, 1);
  });

  it("thickens the frame as the print long-edge shrinks", () => {
    const width = 600;
    const large = ringPxForPreviewWidth("standard", 841, width, 1.5);
    const small = ringPxForPreviewWidth("standard", 420, width, 1.5);
    expect(small).toBeGreaterThan(large);
  });
});
