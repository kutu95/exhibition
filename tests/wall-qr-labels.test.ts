import { describe, expect, it } from "vitest";

import { buildWallProductUrl } from "../lib/exhibition-links";
import {
  buildWallQrLabelsPdf,
  sortWallQrProducts,
  wallQrSheetPageCount,
  WALL_QR_LABELS_PER_PAGE,
  WALL_QR_SIZE_MM,
} from "../lib/wall-qr-labels";

describe("wall QR label sheets", () => {
  it("prints each QR at 5 cm on A4 with 12 labels per sheet", () => {
    expect(WALL_QR_SIZE_MM).toBe(50);
    expect(WALL_QR_LABELS_PER_PAGE).toBe(12);
    expect(wallQrSheetPageCount(0)).toBe(1);
    expect(wallQrSheetPageCount(1)).toBe(2);
    expect(wallQrSheetPageCount(12)).toBe(2);
    expect(wallQrSheetPageCount(13)).toBe(3);
    expect(wallQrSheetPageCount(58)).toBe(6);
  });

  it("groups photographs by location then title", () => {
    expect(
      sortWallQrProducts([
        { title: "B", slug: "b", location_tag: "Redgate Beach" },
        { title: "A", slug: "a", location_tag: "Contos" },
        { title: "C", slug: "c", location_tag: "Contos" },
      ]).map((product) => product.slug),
    ).toEqual(["a", "c", "b"]);
  });

  it("writes a PDF with wall URLs, A4 media boxes, and one sheet per 12 labels", () => {
    const pdf = buildWallQrLabelsPdf([
      { title: "Cliff Island", slug: "cliff-island", location_tag: "Cosy Corner", visibility: "public" },
      { title: "Angel of Contos", slug: "angel-of-contos", location_tag: "Contos", visibility: "vault" },
    ]);
    const text = pdf.toString("latin1");

    expect(pdf.subarray(0, 8).toString("utf8")).toBe("%PDF-1.4");
    expect(text).toContain("/MediaBox [0 0 595.276 841.89]");
    expect(text).toContain("Cliff Island");
    expect(text).toContain("Angel of Contos");
    expect(text).toContain("Print at 100% / Actual size");
    expect(text).toContain("Each square is 5 cm by 5 cm");
    expect(text).toContain("/Count 2");
    expect(buildWallProductUrl("cliff-island")).toContain("src=wall");
  });
});
