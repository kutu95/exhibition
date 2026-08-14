import { createHash, timingSafeEqual } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSessionToken, getAdminCookieConfig, isSecureAdminRequest } from "../../../../../lib/admin-auth";
import {
  checkAdminLoginRateLimit,
  clearAdminLoginFailures,
  getAdminLoginClientIp,
  recordAdminLoginFailure,
} from "../../../../../lib/admin-login-rate-limit";

export const runtime = "nodejs";

const loginSchema = z.object({
  password: z.string().min(1),
});

const hashValue = (value: string): Buffer => createHash("sha256").update(value).digest();

const comparePassword = (provided: string, expected: string): boolean => {
  const providedHash = hashValue(provided);
  const expectedHash = hashValue(expected);
  return timingSafeEqual(providedHash, expectedHash);
};

const lockedResponse = (retryAfterSeconds: number) => {
  const response = NextResponse.json(
    {
      error: "Too many failed sign-in attempts. Please try again later.",
      retryAfterSeconds,
    },
    { status: 429 },
  );
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
};

export async function POST(request: Request) {
  try {
    const ip = getAdminLoginClientIp(request);
    const rate = checkAdminLoginRateLimit(ip);
    if (!rate.allowed) {
      return lockedResponse(rate.retryAfterSeconds);
    }

    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const expectedPassword = process.env.ADMIN_PASSWORD;
    if (!expectedPassword) {
      return NextResponse.json({ error: "Admin password not configured." }, { status: 500 });
    }
    if (!process.env.ADMIN_SESSION_SECRET) {
      return NextResponse.json({ error: "Admin session secret not configured." }, { status: 500 });
    }

    const valid = comparePassword(parsed.data.password, expectedPassword);
    if (!valid) {
      const afterFailure = recordAdminLoginFailure(ip);
      if (!afterFailure.allowed) {
        return lockedResponse(afterFailure.retryAfterSeconds);
      }
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    clearAdminLoginFailures(ip);

    const token = await createAdminSessionToken();
    const response = NextResponse.json({ success: true });
    const cookieConfig = getAdminCookieConfig({ secure: isSecureAdminRequest(request) });
    response.cookies.set(cookieConfig.name, token, cookieConfig);

    return response;
  } catch (error) {
    console.error("Admin login failed", error);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
