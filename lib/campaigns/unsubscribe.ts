import { SignJWT, jwtVerify } from "jose";

import { siteConfig } from "../metadata";

const UNSUBSCRIBE_MAX_AGE = "365d";

const getSecretKey = (): Uint8Array => {
  const secret =
    process.env.UNSUBSCRIBE_SECRET?.trim() ||
    process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing UNSUBSCRIBE_SECRET or ADMIN_SESSION_SECRET");
  }
  return new TextEncoder().encode(secret);
};

export type UnsubscribeTokenPayload = {
  subscriberId: string;
  email: string;
};

export const createUnsubscribeToken = async (
  payload: UnsubscribeTokenPayload,
): Promise<string> => {
  return new SignJWT({
    email: payload.email,
    status: "unsubscribe",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.subscriberId)
    .setIssuedAt()
    .setExpirationTime(UNSUBSCRIBE_MAX_AGE)
    .sign(getSecretKey());
};

export const verifyUnsubscribeToken = async (
  token: string | undefined,
): Promise<UnsubscribeTokenPayload | null> => {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (payload.status !== "unsubscribe") return null;
    const subscriberId = typeof payload.sub === "string" ? payload.sub : null;
    const email = typeof payload.email === "string" ? payload.email : null;
    if (!subscriberId || !email) return null;
    return { subscriberId, email };
  } catch {
    return null;
  }
};

export const buildUnsubscribeUrl = async (
  payload: UnsubscribeTokenPayload,
): Promise<string> => {
  const token = await createUnsubscribeToken(payload);
  const base = siteConfig.url.replace(/\/$/, "");
  return `${base}/unsubscribe?token=${encodeURIComponent(token)}`;
};
