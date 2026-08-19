import { describe, expect, it } from "vitest";

import {
  STUDIO_ORDER_MARKER,
  buildStudioOrderNotes,
  formatStudioOrderOption,
  isRevenueOrder,
  isStudioOrderNotes,
  pixelPerfectEditionLine,
} from "../lib/studio-orders";

describe("studio orders", () => {
  it("tags notes with a stable marker", () => {
    const notes = buildStudioOrderNotes("hang in studio");
    expect(notes).toContain(STUDIO_ORDER_MARKER);
    expect(notes).toContain("hang in studio");
    expect(isStudioOrderNotes(notes)).toBe(true);
  });

  it("does not treat customer or test-order notes as studio", () => {
    expect(isStudioOrderNotes(null)).toBe(false);
    expect(isStudioOrderNotes("On-site sale. payment=cash")).toBe(false);
    expect(isStudioOrderNotes("Fulfilment test order (no Stripe).")).toBe(false);
  });

  it("excludes studio copies from revenue even when status is paid", () => {
    expect(isRevenueOrder({ status: "paid", notes: buildStudioOrderNotes() })).toBe(false);
    expect(isRevenueOrder({ status: "paid", notes: "source=wall" })).toBe(true);
    expect(isRevenueOrder({ status: "cancelled", notes: null })).toBe(false);
  });

  it("formats open studio order labels for pickers", () => {
    expect(formatStudioOrderOption({ order_number: "EXH-142", print_count: 1 })).toBe("EXH-142 — 1 print");
    expect(formatStudioOrderOption({ order_number: "EXH-142", print_count: 3 })).toBe("EXH-142 — 3 prints");
  });

  it("omits edition numbers from Pixel Perfect copy for studio orders", () => {
    expect(
      pixelPerfectEditionLine({
        edition_number_assigned: 3,
        edition_size: 25,
        is_studio_order: true,
      }),
    ).toBe("Edition: n/a (artist copy)");
    expect(
      pixelPerfectEditionLine({
        edition_number_assigned: 3,
        edition_size: 25,
      }),
    ).toBe("Edition: 3 of 25");
  });
});
