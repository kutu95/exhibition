import { describe, expect, it } from "vitest";

import {
  FRAME_MOULDING_MM,
  FRAME_PREVIEW_MAT_MM,
  FRAME_PREVIEW_PHOTO_LONG_EDGE_PX,
  matPxForPrintLongEdge,
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

  it("renders Deluxe one-third as thick as Standard preview (10mm vs 30mm face)", () => {
    const standard = ringPxForPrintLongEdge("standard", 594);
    const deluxe = ringPxForPrintLongEdge("deluxe", 594);
    expect(FRAME_MOULDING_MM.deluxe).toBe(10);
    expect(FRAME_MOULDING_MM.standard).toBe(30);
    expect(deluxe / standard).toBeCloseTo(10 / 30, 1);
  });

  it("keeps thickening below 550mm with no plateau", () => {
    const at550 = ringPxForPrintLongEdge("standard", 550);
    const at420 = ringPxForPrintLongEdge("standard", 420);
    const at300 = ringPxForPrintLongEdge("standard", 300);
    const at200 = ringPxForPrintLongEdge("standard", 200);
    expect(at420).toBeGreaterThan(at550);
    expect(at300).toBeGreaterThan(at420);
    expect(at200).toBeGreaterThan(at300);
    expect(at200).toBe(Math.round((30 / 200) * FRAME_PREVIEW_PHOTO_LONG_EDGE_PX));
  });

  it("thickens the frame as the print long-edge shrinks", () => {
    const large = ringPxForPrintLongEdge("standard", 841);
    const small = ringPxForPrintLongEdge("standard", 420);
    expect(small).toBeGreaterThan(large);
  });
});

describe("matPxForPrintLongEdge", () => {
  it("scales the preview mat with print long-edge", () => {
    const large = matPxForPrintLongEdge(841);
    const medium = matPxForPrintLongEdge(594);
    const small = matPxForPrintLongEdge(420);
    expect(medium).toBeGreaterThan(large);
    expect(small).toBeGreaterThan(medium);
    expect(medium).toBe(
      Math.min(
        56,
        Math.max(8, Math.round((FRAME_PREVIEW_MAT_MM / 594) * FRAME_PREVIEW_PHOTO_LONG_EDGE_PX)),
      ),
    );
  });
});
