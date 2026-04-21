import { cookies } from "next/headers";

const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3007";
const internalAppOrigin =
  process.env.INTERNAL_APP_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? "3007"}`;

const getCookieHeader = async (): Promise<string> => {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");
};

export const fetchAdminJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const cookieHeader = await getCookieHeader();
  const baseUrl = process.env.NODE_ENV === "production" ? internalAppOrigin : publicSiteUrl;

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      cookie: cookieHeader,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Admin fetch failed for ${path}: ${response.status} ${response.statusText} ${body}`);
  }

  return (await response.json()) as T;
};
