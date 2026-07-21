import { describe, expect, it } from "vitest";

import { buildWallProductUrl } from "../lib/exhibition-links";

describe("exhibition wall links", () => {
  it("builds a product page link for wall QR codes", () => {
    const url = buildWallProductUrl("isaac-rock-no-3");
    expect(url).toContain("/shop/isaac-rock-no-3");
    expect(url).not.toContain("add=");
  });

  it("can optionally preselect a variant", () => {
    expect(buildWallProductUrl("isaac-rock-no-3", "22222222-2222-2222-2222-222222222222")).toContain(
      "variant=22222222-2222-2222-2222-222222222222",
    );
  });
});
