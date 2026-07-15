import { NextResponse } from "next/server";

import { databaseErrorMessage, isDatabaseConnectionError } from "./db-errors";

export const databaseErrorResponse = (error: unknown) =>
  NextResponse.json(
    { error: databaseErrorMessage(error) },
    { status: 503 },
  );

export const handleRouteError = (error: unknown, fallbackMessage: string) => {
  if (isDatabaseConnectionError(error)) {
    console.error(fallbackMessage, error);
    return databaseErrorResponse(error);
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  console.error(fallbackMessage, error);
  return NextResponse.json({ error: message }, { status: 500 });
};
