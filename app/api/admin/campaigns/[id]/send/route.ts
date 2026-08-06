import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { dispatchCampaign } from "../../../../../../lib/campaigns/send";
import { handleRouteError } from "../../../../../../lib/api-route-errors";

export const runtime = "nodejs";
export const maxDuration = 600;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const result = await dispatchCampaign({ campaignId: id });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error ?? "Send failed.",
          sent: result.sent,
          failed: result.failed,
          audience: result.audience,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
      audience: result.audience,
    });
  } catch (error) {
    return handleRouteError(error, "Admin campaign send failed");
  }
}
