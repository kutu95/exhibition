import { describe, expect, it } from "vitest";

import {
  parsePhotoDateMs,
  pickRelatedPrints,
  resolvePhotoDateMs,
  scoreRelatedPrint,
  type RelatedPrintCandidate,
} from "../lib/related-prints";

const base = (overrides: Partial<RelatedPrintCandidate>): RelatedPrintCandidate => ({
  slug: "source",
  title: "Source",
  location_tag: "Redgate Beach",
  photo_type_tag: "Drone",
  created_at: "2026-01-01T00:00:00.000Z",
  master_filename: "20260518_Source.tif",
  theme_ids: ["theme-a"],
  image_url: "/images/source.jpg",
  ...overrides,
});

describe("parsePhotoDateMs", () => {
  it("reads YYYYMMDD from master filenames and slugs", () => {
    expect(parsePhotoDateMs("20260518_DumbartonClyde-Edit.tif")).toBe(Date.UTC(2026, 4, 18));
    expect(parsePhotoDateMs("20190426-isaac-rock-red")).toBe(Date.UTC(2019, 3, 26));
    expect(parsePhotoDateMs("no-date-here")).toBeNull();
  });
});

describe("scoreRelatedPrint", () => {
  const source = base({});

  it("scores location, camera type, themes, and nearby dates", () => {
    const strong = base({
      slug: "twin",
      title: "Twin",
      master_filename: "20260518_Twin.tif",
      theme_ids: ["theme-a", "theme-b"],
      image_url: "/images/twin.jpg",
    });
    const weak = base({
      slug: "elsewhere",
      title: "Elsewhere",
      location_tag: "Contos",
      photo_type_tag: "Still camera",
      master_filename: "20180101_Elsewhere.tif",
      theme_ids: ["theme-z"],
      image_url: "/images/elsewhere.jpg",
    });

    expect(scoreRelatedPrint(source, strong)).toBeGreaterThan(scoreRelatedPrint(source, weak));
    expect(scoreRelatedPrint(source, strong)).toBeGreaterThanOrEqual(5 + 4 + 4 + 5);
  });

  it("falls back to created_at when no capture date is embedded", () => {
    const undated = base({
      slug: "undated",
      master_filename: null,
      created_at: "2026-05-20T00:00:00.000Z",
    });
    expect(resolvePhotoDateMs(undated)).toBe(Date.parse("2026-05-20T00:00:00.000Z"));
  });
});

describe("pickRelatedPrints", () => {
  it("returns the top matches above the minimum score", () => {
    const source = base({});
    const related = pickRelatedPrints(source, [
      base({
        slug: "a",
        title: "A",
        master_filename: "20260518_A.tif",
        image_url: "/images/a.jpg",
      }),
      base({
        slug: "b",
        title: "B",
        master_filename: "20260519_B.tif",
        theme_ids: [],
        image_url: "/images/b.jpg",
      }),
      base({
        slug: "c",
        title: "C",
        location_tag: "Contos",
        photo_type_tag: "Underwater",
        master_filename: "20170101_C.tif",
        theme_ids: ["other"],
        image_url: "/images/c.jpg",
      }),
    ]);

    expect(related.map((row) => row.slug)).toEqual(["a", "b"]);
  });

  it("caps results at the requested limit", () => {
    const source = base({});
    const related = pickRelatedPrints(
      source,
      ["a", "b", "c", "d"].map((slug) =>
        base({
          slug,
          title: slug.toUpperCase(),
          master_filename: `20260518_${slug}.tif`,
          image_url: `/images/${slug}.jpg`,
        }),
      ),
      { limit: 2 },
    );
    expect(related).toHaveLength(2);
  });
});
