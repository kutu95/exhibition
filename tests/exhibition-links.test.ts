import { describe, expect, it } from "vitest";

import { buildWallProductUrl, isWallSource } from "../lib/exhibition-links";

describe("exhibition wall links", () => {
  it("builds a product page link for wall QR codes with src=wall", () => {
    const url = buildWallProductUrl("isaac-rock-no-3");
    expect(url).toContain("/shop/isaac-rock-no-3");
    expect(url).toContain("src=wall");
    expect(url).not.toContain("add=");
  });

  it("can optionally preselect a variant", () => {
    expect(buildWallProductUrl("isaac-rock-no-3", "22222222-2222-2222-2222-222222222222")).toContain(
      "variant=22222222-2222-2222-2222-222222222222",
    );
  });

  it("detects wall source query", () => {
    expect(isWallSource("wall")).toBe(true);
    expect(isWallSource("WALL")).toBe(true);
    expect(isWallSource("shop")).toBe(false);
  });
});
