import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { repriceAllPrintVariants } from "../../../../../lib/print-reprice";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await repriceAllPrintVariants();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return handleRouteError(error, "Admin reprice-all failed");
  }
}
