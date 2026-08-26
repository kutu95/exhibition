import { describe, expect, it } from "vitest";

import { inchesToMm } from "../lib/print-size";
import {
  UNSPECIFIED_PAPER_LABEL,
  formatSqIn,
  groupOrderItemsByPaper,
  itemAreaSqIn,
} from "../lib/order-item-paper-groups";

describe("order item paper groups", () => {
  it("computes square inches from millimetres times quantity", () => {
    expect(itemAreaSqIn(inchesToMm(10), inchesToMm(8), 2)).toBeCloseTo(160, 5);
  });

  it("groups by paper type with area and lab-cost subtotals", () => {
    const groups = groupOrderItemsByPaper([
      {
        id: "a",
        paper_type: "Hahnemühle Photo Rag 308gsm",
        width_mm: inchesToMm(10),
        height_mm: inchesToMm(8),
        quantity: 1,
        lab_cost_aud: 1200,
      },
      {
        id: "b",
        paper_type: "Ready to Hang Canvas",
        width_mm: inchesToMm(20),
        height_mm: inchesToMm(16),
        quantity: 1,
        lab_cost_aud: 4500,
      },
      {
        id: "c",
        paper_type: "Hahnemühle Photo Rag 308gsm",
        width_mm: inchesToMm(10),
        height_mm: inchesToMm(8),
        quantity: 2,
        lab_cost_aud: 1200,
      },
      {
        id: "d",
        paper_type: null,
        width_mm: null,
        height_mm: null,
        quantity: 1,
        lab_cost_aud: null,
      },
    ]);

    expect(groups.map((group) => group.paperLabel)).toEqual([
      "Hahnemühle Photo Rag 308gsm",
      "Ready to Hang Canvas",
      UNSPECIFIED_PAPER_LABEL,
    ]);

    expect(groups[0].items.map((item) => item.id)).toEqual(["a", "c"]);
    expect(groups[0].areaSqIn).toBeCloseTo(240, 5);
    expect(groups[0].labCostCents).toBe(3600);

    expect(groups[1].areaSqIn).toBeCloseTo(320, 5);
    expect(groups[1].labCostCents).toBe(4500);

    expect(groups[2].areaSqIn).toBe(0);
    expect(groups[2].labCostCents).toBe(0);
  });

  it("formats square inches for the order table", () => {
    expect(formatSqIn(240)).toBe("240 sq in");
    expect(formatSqIn(1234.56)).toBe("1,234.56 sq in");
  });
});
