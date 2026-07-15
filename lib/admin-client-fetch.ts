"use client";

import { databaseErrorMessage, isDatabaseConnectionError } from "./db-errors";

const ADMIN_CLIENT_FETCH_TIMEOUT_MS = 20_000;

export const adminClientFetch = async (
  path: string,
  init?: RequestInit,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ADMIN_CLIENT_FETCH_TIMEOUT_MS);

  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort(init.signal.reason);
    } else {
      init.signal.addEventListener(
        "abort",
        () => controller.abort(init.signal?.reason),
        { once: true },
      );
    }
  }

  try {
    return await fetch(path, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const adminClientFetchError = (error: unknown): string => {
  if (isDatabaseConnectionError(error)) {
    return databaseErrorMessage(error);
  }

  return error instanceof Error ? error.message : "Request failed.";
};
