export const DEFAULT_DB_TIMEOUT_MS = 15_000;

export class DatabaseConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseConnectionError";
  }
}

export class DatabaseTimeoutError extends DatabaseConnectionError {
  readonly timeoutMs: number;
  readonly operation: string;

  constructor(operation: string, timeoutMs: number) {
    super(`Database timed out after ${timeoutMs}ms (${operation}).`);
    this.name = "DatabaseTimeoutError";
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

export const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_DB_TIMEOUT_MS,
  operation = "database operation",
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new DatabaseTimeoutError(operation, timeoutMs));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const isDatabaseConnectionError = (error: unknown): boolean => {
  if (error instanceof DatabaseConnectionError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const code =
    "code" in error && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  const message = error.message.toLowerCase();

  return (
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ECONNRESET" ||
    code === "57P01" ||
    error.name === "AbortError" ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("connection terminated") ||
    message.includes("connect etimedout") ||
    message.includes("could not connect") ||
    message.includes("connection refused")
  );
};

export const databaseErrorMessage = (error: unknown): string => {
  if (error instanceof DatabaseTimeoutError) {
    return "The database did not respond in time. Check that Postgres/Supabase is running, then try again.";
  }

  if (isDatabaseConnectionError(error)) {
    return "Could not reach the database. Check that Postgres/Supabase is running and try again.";
  }

  return error instanceof Error ? error.message : "An unexpected database error occurred.";
};
