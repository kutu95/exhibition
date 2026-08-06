import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { processDueScheduledCampaigns } from "../../../../../lib/campaigns/send";
import { handleRouteError } from "../../../../../lib/api-route-errors";

export const runtime = "nodejs";
export const maxDuration = 600;

/**
 * Process campaigns with status=scheduled and scheduled_at <= now.
 * Auth: admin session cookie, or Authorization: Bearer CRON_SECRET / FULFILMENT_API_KEY.
 */
export async function POST(request: Request) {
  const cronSecret =
    process.env.CRON_SECRET?.trim() || process.env.FULFILMENT_API_KEY?.trim() || "";
  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const isCron = Boolean(cronSecret && bearer && bearer === cronSecret);
  const isAdmin = await verifyAdminSession(request);

  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processDueScheduledCampaigns();
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "Process scheduled campaigns failed");
  }
}
