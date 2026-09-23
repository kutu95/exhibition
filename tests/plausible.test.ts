import { describe, expect, it } from "vitest";

import { ALIAS_HOSTS, CANONICAL_HOST, isPublicAppHost } from "../lib/metadata";
import { PLAUSIBLE_SITE_DOMAIN, plausibleDataDomain } from "../lib/plausible";

describe("plausibleDataDomain", () => {
  it("lists the existing Plausible site first, then both public hosts", () => {
    const domains = plausibleDataDomain().split(",");
    expect(domains[0]).toBe(PLAUSIBLE_SITE_DOMAIN);
    expect(domains).toContain(CANONICAL_HOST);
    expect(domains).toContain(ALIAS_HOSTS[0]);
    expect(new Set(domains).size).toBe(domains.length);
  });
});

describe("isPublicAppHost", () => {
  it("accepts the canonical host and the exhibition alias", () => {
    expect(isPublicAppHost("margies.app")).toBe(true);
    expect(isPublicAppHost("exhibition.margies.app")).toBe(true);
    expect(isPublicAppHost("www.margies.app")).toBe(true);
    expect(isPublicAppHost("storage.margies.app")).toBe(false);
  });
});
