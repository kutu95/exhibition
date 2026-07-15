import { cookies } from "next/headers";

import {
  DatabaseConnectionError,
  databaseErrorMessage,
  isDatabaseConnectionError,
} from "../../../lib/db-errors";
import { fetchWithTimeout } from "../../../lib/fetch-with-timeout";

const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3007";
const internalAppOrigin =
  process.env.INTERNAL_APP_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? "3007"}`;

/** Server-side admin fetches include API work + DB; allow a bit more than raw DB timeout. */
const ADMIN_FETCH_TIMEOUT_MS = 20_000;

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

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}${path}`,
      {
        ...init,
        cache: "no-store",
        headers: {
          ...(init?.headers ?? {}),
          cookie: cookieHeader,
        },
      },
      ADMIN_FETCH_TIMEOUT_MS,
    );

    if (response.status === 503) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new DatabaseConnectionError(
        body?.error ?? "The database is unavailable. Check Postgres/Supabase and try again.",
      );
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Admin fetch failed for ${path}: ${response.status} ${response.statusText} ${body}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof DatabaseConnectionError) {
      throw error;
    }

    if (isDatabaseConnectionError(error)) {
      throw new DatabaseConnectionError(databaseErrorMessage(error));
    }

    throw error;
  }
};
