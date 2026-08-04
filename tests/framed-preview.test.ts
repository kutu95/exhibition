import { describe, expect, it } from "vitest";

import {
  FRAME_MOULDING_MM,
  FRAME_PREVIEW_PHOTO_LONG_EDGE_PX,
  ringPxForPrintLongEdge,
} from "../components/FramedPreview";

describe("ringPxForPrintLongEdge", () => {
  it("matches moulding / print long-edge ratio", () => {
    const printLong = 594;
    const ring = ringPxForPrintLongEdge("standard", printLong);
    expect(ring / FRAME_PREVIEW_PHOTO_LONG_EDGE_PX).toBeCloseTo(
      FRAME_MOULDING_MM.standard / printLong,
      2,
    );
  });

  it("renders Deluxe half as thick as Standard (10mm vs 20mm)", () => {
    const standard = ringPxForPrintLongEdge("standard", 594);
    const deluxe = ringPxForPrintLongEdge("deluxe", 594);
    expect(deluxe / standard).toBeCloseTo(0.5, 5);
  });

  it("keeps thickening below 550mm with no plateau", () => {
    const at550 = ringPxForPrintLongEdge("standard", 550);
    const at420 = ringPxForPrintLongEdge("standard", 420);
    const at300 = ringPxForPrintLongEdge("standard", 300);
    const at200 = ringPxForPrintLongEdge("standard", 200);
    expect(at420).toBeGreaterThan(at550);
    expect(at300).toBeGreaterThan(at420);
    expect(at200).toBeGreaterThan(at300);
    expect(at200).toBe(Math.round((20 / 200) * FRAME_PREVIEW_PHOTO_LONG_EDGE_PX));
  });

  it("thickens the frame as the print long-edge shrinks", () => {
    const large = ringPxForPrintLongEdge("standard", 841);
    const small = ringPxForPrintLongEdge("standard", 420);
    expect(small).toBeGreaterThan(large);
  });
});
