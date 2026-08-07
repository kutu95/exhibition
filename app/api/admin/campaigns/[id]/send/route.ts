import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { dispatchCampaign } from "../../../../../../lib/campaigns/send";
import { handleRouteError } from "../../../../../../lib/api-route-errors";

export const runtime = "nodejs";
export const maxDuration = 600;

type RouteContext = {
  params: Promise<{ id: string }>;
};

const bodySchema = z.object({
  audience: z.enum(["subscribers", "talk_registrations"]).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid send request." }, { status: 400 });
    }

    const result = await dispatchCampaign({
      campaignId: id,
      audience: parsed.data.audience,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error ?? "Send failed.",
          sent: result.sent,
          failed: result.failed,
          audience: result.audience,
          audience_type: result.audience_type,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      sent: result.sent,
      failed: result.failed,
      audience: result.audience,
      audience_type: result.audience_type,
    });
  } catch (error) {
    return handleRouteError(error, "Admin campaign send failed");
  }
}
