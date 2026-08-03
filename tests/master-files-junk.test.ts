import { describe, expect, it } from "vitest";

import { isAppleDoubleSidecar, isIgnorableMasterDirEntry } from "../lib/master-files";

describe("master-files junk filtering", () => {
  it("recognises macOS AppleDouble sidecars", () => {
    expect(isAppleDoubleSidecar("._Redgate Beach.tif")).toBe(true);
    expect(isAppleDoubleSidecar("._photo.tiff")).toBe(true);
    expect(isAppleDoubleSidecar("Redgate Beach.tif")).toBe(false);
    expect(isAppleDoubleSidecar("_temp.tif")).toBe(false);
  });

  it("ignores hidden and system entries", () => {
    expect(isIgnorableMasterDirEntry(".DS_Store")).toBe(true);
    expect(isIgnorableMasterDirEntry("Thumbs.db")).toBe(true);
    expect(isIgnorableMasterDirEntry("._anything.tif")).toBe(true);
    expect(isIgnorableMasterDirEntry(".hidden.tif")).toBe(true);
    expect(isIgnorableMasterDirEntry("master.tif")).toBe(false);
  });
});
