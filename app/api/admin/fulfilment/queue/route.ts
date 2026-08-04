import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { getFulfilmentQueue } from "../../../../../lib/fulfilment-items";
import { findLocalPrintFile } from "../../../../../lib/print-output-files";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await getFulfilmentQueue();
    const enriched = await Promise.all(
      items.map(async ({ events: _events, ...item }) => {
        const local = await findLocalPrintFile(item);
        return {
          ...item,
          local_print_file_path: local?.path ?? null,
          local_print_file_name: local?.name ?? null,
        };
      }),
    );

    return NextResponse.json({
      items: enriched,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    return handleRouteError(error, "Admin fulfilment queue failed");
  }
}
