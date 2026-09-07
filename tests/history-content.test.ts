import { describe, expect, it } from "vitest";

import { getHistoryPage, getPublishedHistoryPages } from "../lib/history-content";
import { isIndexablePrintPage } from "../lib/print-editorial";

describe("published history pages", () => {
  it("exposes the two sourced research articles Google can index", async () => {
    const pages = await getPublishedHistoryPages();
    const slugs = pages.map((page) => page.slug).sort();

    expect(slugs).toEqual(["catalpa-pursuit", "grace-bussell-legend"]);

    for (const page of pages) {
      expect(page.wordCount).toBeGreaterThan(800);
      expect(page.sources.length).toBeGreaterThan(0);
      expect(page.html).not.toMatch(/\[VERIFY\]|\[SOURCE NEEDED\]|\[EXPAND\]/);
    }
  });

  it("does not route unfinished drafts", async () => {
    await expect(getHistoryPage("ss-georgette")).resolves.toBeNull();
    await expect(getHistoryPage("sam-isaacs")).resolves.toBeNull();
  });
});

describe("indexable print pages", () => {
  it("keeps unique editorial prints indexable and withholds thin catalogue URLs", () => {
    expect(isIndexablePrintPage("redgate-beach-panorama-1-1")).toBe(true);
    expect(isIndexablePrintPage("celestial-rock")).toBe(true);
    expect(isIndexablePrintPage("cliff-island")).toBe(false);
    expect(isIndexablePrintPage("stormy-rainbow")).toBe(false);
  });
});
