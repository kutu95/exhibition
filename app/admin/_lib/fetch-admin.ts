import { cookies } from "next/headers";

const fallbackSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3007";

const getCookieHeader = async (): Promise<string> => {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${encodeURIComponent(cookie.value)}`)
    .join("; ");
};

export const fetchAdminJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const cookieHeader = await getCookieHeader();

  const response = await fetch(`${fallbackSiteUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers ?? {}),
      cookie: cookieHeader,
    },
  });

  if (!response.ok) {
    throw new Error(`Admin fetch failed for ${path}`);
  }

  return (await response.json()) as T;
};
