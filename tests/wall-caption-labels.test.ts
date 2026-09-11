import { describe, expect, it } from "vitest";

import {
  buildWallCaptionLabelsPdf,
  CAPTION_LABEL_WIDTH_MM,
  CAPTION_PAGE_HEIGHT_MM,
  CAPTION_PAGE_WIDTH_MM,
  packWallCaptionPages,
} from "../lib/wall-caption-labels";

describe("wall caption label sheets", () => {
  it("prints labels the full width of A4 portrait", () => {
    expect(CAPTION_LABEL_WIDTH_MM).toBe(210);
    expect(CAPTION_PAGE_WIDTH_MM).toBe(210);
    expect(CAPTION_PAGE_HEIGHT_MM).toBe(297);
  });

  it("writes title, description, and transcript, and omits empty transcript copy", () => {
    const pdf = buildWallCaptionLabelsPdf([
      {
        title: "Cliff Island",
        slug: "cliff-island",
        location_tag: "Cosy Corner",
        description: "This rocky island is a favourite of cliff jumpers in summer.",
        audio_transcript: "This rock island is just across the channel from an outcrop.",
        visibility: "public",
      },
      {
        title: "Contos Spirit",
        slug: "contos-spirit",
        location_tag: "Contos",
        description: "Susanna, barefoot, in the coastal heath of Contos.",
        audio_transcript: null,
        visibility: "public",
      },
    ]);
    const text = pdf.toString("latin1");

    expect(pdf.subarray(0, 8).toString("utf8")).toBe("%PDF-1.4");
    expect(text).toContain("/MediaBox [0 0 595.276 841.89]");
    expect(text).toContain("Cliff Island");
    expect(text).toContain("This rocky island is a favourite of cliff jumpers in summer.");
    expect(text).toContain("This rock island is just across the channel from an outcrop.");
    expect(text).toContain("Contos Spirit");
    expect(text).toContain("Susanna, barefoot, in the coastal heath of Contos.");
    expect(text).toContain("Transcript");
    expect(text).toContain("/Times-Roman");
    expect(text).toContain("/Times-Italic");
    expect(text).not.toContain("...");
  });

  it("wraps a long transcript instead of truncating it", () => {
    const transcript = Array.from({ length: 40 }, (_, index) => `Sentence ${index + 1} about the wreck.`).join(" ");
    const pdf = buildWallCaptionLabelsPdf([
      {
        title: "Georgette Birthplace",
        slug: "georgette-birthplace",
        location_tag: "Scotland",
        description: "Just across the river Leven is the location where the Georgette was built.",
        audio_transcript: transcript,
        visibility: "public",
      },
    ]);
    const text = pdf.toString("latin1");
    expect(text).toContain("Sentence 1 about the wreck.");
    expect(text).toContain("Sentence 40 about the wreck.");
    expect(text).not.toContain("...");
  });
});

describe("wall caption packing", () => {
  it("starts a new sheet when the next label will not fit", () => {
    const pages = packWallCaptionPages([
      {
        product: { title: "A", slug: "a", location_tag: "Redgate" },
        titleLines: ["A"],
        descriptionLines: [],
        transcriptLines: [],
        heightMm: 160,
      },
      {
        product: { title: "B", slug: "b", location_tag: "Redgate" },
        titleLines: ["B"],
        descriptionLines: [],
        transcriptLines: [],
        heightMm: 160,
      },
    ]);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toHaveLength(1);
    expect(pages[1]).toHaveLength(1);
  });
});
