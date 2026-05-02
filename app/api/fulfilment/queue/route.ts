import { NextResponse } from "next/server";

import { verifyBearerApiKey } from "../../../../lib/api-key-auth";
import { getFulfilmentQueue } from "../../../../lib/fulfilment-items";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!verifyBearerApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const items = await getFulfilmentQueue();

    return NextResponse.json({
      items: items.map(({ events: _events, ...item }) => item),
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Fulfilment queue failed", error);
    return NextResponse.json({ error: "Failed to fetch fulfilment queue." }, { status: 500 });
  }
}
