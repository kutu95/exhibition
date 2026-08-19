import { createHash, randomBytes } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

export const VAULT_SESSION_COOKIE = "vault_session";
export const VAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type VaultSessionPayload = {
  inviteIds: string[];
};

const getSecretKey = (): Uint8Array => {
  const secret = process.env.VAULT_SESSION_SECRET?.trim() || process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing VAULT_SESSION_SECRET or ADMIN_SESSION_SECRET");
  }
  return new TextEncoder().encode(secret);
};

const getCookieValue = (cookieHeader: string | null, name: string): string | null => {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(";").map((segment) => segment.trim());
  const target = `${name}=`;
  const match = pairs.find((pair) => pair.startsWith(target));
  return match ? decodeURIComponent(match.slice(target.length)) : null;
};

const uniqueInviteIds = (ids: string[]): string[] => [...new Set(ids.filter(Boolean))];

export const hashVaultToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const createVaultInviteToken = (): string => randomBytes(32).toString("base64url");

export const createVaultSessionToken = async (
  inviteIds: string[],
  expiresAt: Date | null,
): Promise<string> => {
  const ids = uniqueInviteIds(inviteIds);
  if (ids.length === 0) {
    throw new Error("Vault session requires at least one invite.");
  }

  const builder = new SignJWT({
    vault: true,
    inviteId: ids[ids.length - 1],
    inviteIds: ids,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt();

  if (expiresAt) {
    builder.setExpirationTime(expiresAt);
  } else {
    builder.setExpirationTime(`${VAULT_SESSION_MAX_AGE_SECONDS}s`);
  }

  return builder.sign(getSecretKey());
};

export const verifyVaultSessionToken = async (
  token: string | undefined,
): Promise<VaultSessionPayload | null> => {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (payload.vault !== true) {
      return null;
    }

    const inviteIds: string[] = [];
    if (Array.isArray(payload.inviteIds)) {
      for (const id of payload.inviteIds) {
        if (typeof id === "string" && id.trim()) {
          inviteIds.push(id);
        }
      }
    }
    if (typeof payload.inviteId === "string" && payload.inviteId.trim()) {
      inviteIds.push(payload.inviteId);
    }

    const unique = uniqueInviteIds(inviteIds);
    return unique.length > 0 ? { inviteIds: unique } : null;
  } catch {
    return null;
  }
};

export const verifyVaultSessionFromRequest = async (
  request: Request,
): Promise<VaultSessionPayload | null> => {
  const token = getCookieValue(request.headers.get("cookie"), VAULT_SESSION_COOKIE) ?? undefined;
  return verifyVaultSessionToken(token);
};

export const getVaultCookieConfig = (maxAgeSeconds = VAULT_SESSION_MAX_AGE_SECONDS) => ({
  name: VAULT_SESSION_COOKIE,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSeconds,
});

export const buildVaultAccessUrl = (rawToken: string): string => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3007";
  return `${siteUrl.replace(/\/$/, "")}/collections/access?t=${encodeURIComponent(rawToken)}`;
};
