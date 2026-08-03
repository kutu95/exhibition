import { describe, expect, it } from "vitest";

import {
  arePurchasesAllowedForHost,
  hostnameFromHostHeader,
  isLanHostname,
} from "../lib/purchases-access";

describe("purchases-access", () => {
  it("recognises loopback and private hosts as LAN", () => {
    expect(isLanHostname("localhost")).toBe(true);
    expect(isLanHostname("127.0.0.1")).toBe(true);
    expect(isLanHostname("::1")).toBe(true);
    expect(isLanHostname("192.168.0.146")).toBe(true);
    expect(isLanHostname("10.0.0.5")).toBe(true);
    expect(isLanHostname("172.16.1.1")).toBe(true);
    expect(isLanHostname("john-ubuntu.local")).toBe(true);
  });

  it("rejects the public site host", () => {
    expect(isLanHostname("exhibition.margies.app")).toBe(false);
    expect(isLanHostname("margies.app")).toBe(false);
  });

  it("strips ports from Host headers", () => {
    expect(hostnameFromHostHeader("localhost:3007")).toBe("localhost");
    expect(hostnameFromHostHeader("192.168.0.146:3007")).toBe("192.168.0.146");
    expect(hostnameFromHostHeader("[::1]:3007")).toBe("::1");
  });

  it("allows all hosts when the env gate is off", () => {
    const previous = process.env.PURCHASES_LAN_ONLY;
    delete process.env.PURCHASES_LAN_ONLY;
    expect(arePurchasesAllowedForHost("exhibition.margies.app")).toBe(true);
    process.env.PURCHASES_LAN_ONLY = previous;
  });

  it("blocks the public host when the env gate is on", () => {
    const previous = process.env.PURCHASES_LAN_ONLY;
    process.env.PURCHASES_LAN_ONLY = "true";
    expect(arePurchasesAllowedForHost("exhibition.margies.app")).toBe(false);
    expect(arePurchasesAllowedForHost("localhost:3007")).toBe(true);
    process.env.PURCHASES_LAN_ONLY = previous;
  });
});
