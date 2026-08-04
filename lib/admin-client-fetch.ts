"use client";

import { databaseErrorMessage, isDatabaseConnectionError } from "./db-errors";

/** Default for ordinary admin GETs/POSTs. */
const ADMIN_CLIENT_FETCH_TIMEOUT_MS = 20_000;

/** Publish / media work (TIFF web-image generation alone allows 120s server-side). */
export const ADMIN_CLIENT_FETCH_LONG_TIMEOUT_MS = 180_000;

type AdminClientFetchOptions = RequestInit & {
  timeoutMs?: number;
};

export const adminClientFetch = async (
  path: string,
  init?: AdminClientFetchOptions,
): Promise<Response> => {
  const { timeoutMs = ADMIN_CLIENT_FETCH_TIMEOUT_MS, ...requestInit } = init ?? {};
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (requestInit.signal) {
    if (requestInit.signal.aborted) {
      controller.abort(requestInit.signal.reason);
    } else {
      requestInit.signal.addEventListener(
        "abort",
        () => controller.abort(requestInit.signal?.reason),
        { once: true },
      );
    }
  }

  try {
    return await fetch(path, {
      ...requestInit,
      credentials: requestInit.credentials ?? "same-origin",
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

  if (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return "That request timed out. Try again — publishing a large master can take a couple of minutes.";
  }

  if (error instanceof Error && /aborted|abort/i.test(error.message)) {
    return "That request timed out. Try again — publishing a large master can take a couple of minutes.";
  }

  return error instanceof Error ? error.message : "Request failed.";
};
