import { describe, expect, it } from "vitest";

import {
  buildWallTitleLabelsPdf,
  TITLE_LABEL_HEIGHT_MM,
  TITLE_LABEL_WIDTH_MM,
  TITLE_LABELS_PER_PAGE,
} from "../lib/wall-title-labels";

describe("wall title label sheets", () => {
  it("prints 186 by 40 mm title strips, one per row, six per A4 sheet", () => {
    expect(TITLE_LABEL_WIDTH_MM).toBe(186);
    expect(TITLE_LABEL_HEIGHT_MM).toBe(40);
    expect(TITLE_LABELS_PER_PAGE).toBe(6);
  });

  it("writes a title-only PDF with crop marks, credit lines, and no matching numbers", () => {
    const pdf = buildWallTitleLabelsPdf([
      {
        title: "Cliff Island",
        slug: "cliff-island",
        location_tag: "Cosy Corner",
        credit_attribution: "Credit: WA Shipwrecks Museum",
        visibility: "public",
      },
      { title: "Angel of Contos", slug: "angel-of-contos", location_tag: "Contos", visibility: "vault" },
    ]);
    const text = pdf.toString("latin1");

    expect(pdf.subarray(0, 8).toString("utf8")).toBe("%PDF-1.4");
    expect(text).toContain("/MediaBox [0 0 595.276 841.89]");
    expect(text).toContain("Cliff Island");
    expect(text).toContain("Angel of Contos");
    expect(text).toContain("Credit: WA Shipwrecks Museum");
    expect(text).toContain("/Times-Roman");
    expect(text).toContain("/Times-Italic");
    expect(text).not.toContain("private");
    expect(text).not.toContain("Sheet ");
    expect(text).not.toContain("p.2");
    expect(text).not.toContain("1. ");
  });
});
