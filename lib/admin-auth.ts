import { jwtVerify, SignJWT } from "jose";

export const ADMIN_SESSION_COOKIE = "admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

const getSecretKey = (): Uint8Array => {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing ADMIN_SESSION_SECRET");
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

export const createAdminSessionToken = async (): Promise<string> => {
  return new SignJWT({
    status: "authenticated",
    ts: Date.now(),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(getSecretKey());
};

export const verifyAdminSessionToken = async (token: string | undefined): Promise<boolean> => {
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    return payload.status === "authenticated";
  } catch {
    return false;
  }
};

export const verifyAdminSession = async (request: Request): Promise<boolean> => {
  const cookieHeader = request.headers.get("cookie");
  const token = getCookieValue(cookieHeader, ADMIN_SESSION_COOKIE) ?? undefined;
  return verifyAdminSessionToken(token);
};

export const getAdminCookieConfig = () => ({
  name: ADMIN_SESSION_COOKIE,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
});
