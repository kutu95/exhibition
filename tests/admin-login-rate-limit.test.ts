import { afterEach, describe, expect, it } from "vitest";

import {
  ADMIN_LOGIN_LOCKOUT_MS,
  ADMIN_LOGIN_MAX_FAILURES,
  ADMIN_LOGIN_WINDOW_MS,
  checkAdminLoginRateLimit,
  clearAdminLoginFailures,
  getAdminLoginClientIp,
  recordAdminLoginFailure,
  resetAdminLoginRateLimitForTests,
} from "../lib/admin-login-rate-limit";

afterEach(() => {
  resetAdminLoginRateLimitForTests();
});

describe("admin-login-rate-limit", () => {
  it("prefers Cloudflare connecting IP", () => {
    const request = new Request("https://example.com/api/admin/auth/login", {
      headers: {
        "cf-connecting-ip": "1.2.3.4",
        "x-forwarded-for": "9.9.9.9, 8.8.8.8",
        "x-real-ip": "7.7.7.7",
      },
    });
    expect(getAdminLoginClientIp(request)).toBe("1.2.3.4");
  });

  it("falls back to the first x-forwarded-for hop", () => {
    const request = new Request("https://example.com/api/admin/auth/login", {
      headers: {
        "x-forwarded-for": "9.9.9.9, 8.8.8.8",
      },
    });
    expect(getAdminLoginClientIp(request)).toBe("9.9.9.9");
  });

  it("allows attempts until the failure limit, then locks the IP", () => {
    const ip = "203.0.113.10";
    const start = 1_700_000_000_000;

    for (let i = 0; i < ADMIN_LOGIN_MAX_FAILURES - 1; i += 1) {
      const result = recordAdminLoginFailure(ip, start + i);
      expect(result.allowed).toBe(true);
      expect(checkAdminLoginRateLimit(ip, start + i).allowed).toBe(true);
    }

    const lock = recordAdminLoginFailure(ip, start + ADMIN_LOGIN_MAX_FAILURES);
    expect(lock.allowed).toBe(false);
    if (lock.allowed) throw new Error("expected lockout");
    expect(lock.retryAfterSeconds).toBe(Math.ceil(ADMIN_LOGIN_LOCKOUT_MS / 1000));

    const blocked = checkAdminLoginRateLimit(ip, start + ADMIN_LOGIN_MAX_FAILURES + 1_000);
    expect(blocked.allowed).toBe(false);
  });

  it("clears failures after a successful login", () => {
    const ip = "203.0.113.11";
    const start = 1_700_000_000_000;

    for (let i = 0; i < ADMIN_LOGIN_MAX_FAILURES - 1; i += 1) {
      recordAdminLoginFailure(ip, start + i);
    }

    clearAdminLoginFailures(ip);
    expect(checkAdminLoginRateLimit(ip, start + 10).allowed).toBe(true);

    const afterClear = recordAdminLoginFailure(ip, start + 11);
    expect(afterClear.allowed).toBe(true);
  });

  it("starts a fresh window after the failure window expires (without lockout)", () => {
    const ip = "203.0.113.12";
    const start = 1_700_000_000_000;

    recordAdminLoginFailure(ip, start);
    recordAdminLoginFailure(ip, start + 1);

    const later = start + ADMIN_LOGIN_WINDOW_MS + 1;
    const result = recordAdminLoginFailure(ip, later);
    expect(result.allowed).toBe(true);
    expect(checkAdminLoginRateLimit(ip, later).allowed).toBe(true);
  });
});
