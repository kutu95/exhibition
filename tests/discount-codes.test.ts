import { describe, expect, it } from "vitest";

import {
  discountAmountCents,
  isDiscountCodeFormat,
  isDiscountPercent,
  normalizeDiscountCode,
  perthCalendarDate,
  suggestDiscountCode,
} from "../lib/discount-codes";

describe("discount codes", () => {
  it("normalises board codes to uppercase without spaces", () => {
    expect(normalizeDiscountCode("  red gate 15 ")).toBe("REDGATE15");
    expect(normalizeDiscountCode("isaac-rock")).toBe("ISAAC-ROCK");
  });

  it("accepts board-friendly codes and rejects junk", () => {
    expect(isDiscountCodeFormat("REDGATE")).toBe(true);
    expect(isDiscountCodeFormat("AB3K7Q")).toBe(true);
    expect(isDiscountCodeFormat("A2")).toBe(false);
    expect(isDiscountCodeFormat("RED--GATE")).toBe(false);
    expect(isDiscountCodeFormat("-REDGATE")).toBe(false);
  });

  it("only allows the offered percents", () => {
    expect(isDiscountPercent(15)).toBe(true);
    expect(isDiscountPercent(20)).toBe(true);
    expect(isDiscountPercent(12)).toBe(false);
  });

  it("rounds the discount in cents from the print subtotal", () => {
    expect(discountAmountCents(7500, 15)).toBe(1125);
    expect(discountAmountCents(7500, 20)).toBe(1500);
    expect(discountAmountCents(0, 15)).toBe(0);
  });

  it("uses Australia/Perth for the calendar day", () => {
    // 10 Sep 2026 16:00 UTC is already 11 Sep in Perth (UTC+8).
    expect(perthCalendarDate(new Date("2026-09-10T16:00:00.000Z"))).toBe("2026-09-11");
    expect(perthCalendarDate(new Date("2026-09-11T15:59:00.000Z"))).toBe("2026-09-11");
  });

  it("suggests a six-character unambiguous code", () => {
    const code = suggestDiscountCode(() => 0);
    expect(code).toHaveLength(6);
    expect(isDiscountCodeFormat(code)).toBe(true);
  });
});
