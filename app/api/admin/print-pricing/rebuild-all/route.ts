import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { rebuildAllPrintOfferVariants } from "../../../../../lib/print-rebuild";

export async function POST(request: Request) {
  try {
    const isAuthed = await verifyAdminSession(request);
    if (!isAuthed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await rebuildAllPrintOfferVariants();
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Admin rebuild-all print options failed");
  }
}
