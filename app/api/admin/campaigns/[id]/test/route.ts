import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { dispatchCampaign } from "../../../../../../lib/campaigns/send";
import { handleRouteError } from "../../../../../../lib/api-route-errors";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = {
  params: Promise<{ id: string }>;
};

const bodySchema = z.object({
  to: z.string().email(),
  first_name: z.string().max(80).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Provide a valid test email address." }, { status: 400 });
    }

    // Persist latest draft fields before test if client sent nothing — test uses DB state.
    const result = await dispatchCampaign({
      campaignId: id,
      testTo: parsed.data.to,
      testFirstName: parsed.data.first_name ?? null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Test send failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sent: result.sent });
  } catch (error) {
    return handleRouteError(error, "Admin campaign test send failed");
  }
}
