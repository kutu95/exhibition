import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../../lib/api-route-errors";
import { isCampaignEmailConfigured, sendCampaignEmail } from "../../../../../../lib/emails/campaign";
import { isEmailTemplateSlug } from "../../../../../../lib/emails/template-defs";
import { previewEmailTemplate } from "../../../../../../lib/emails/templates";
import { siteConfig } from "../../../../../../lib/metadata";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

const bodySchema = z.object({
  to: z.string().email(),
});

export async function POST(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;
  if (!isEmailTemplateSlug(slug)) {
    return NextResponse.json({ error: "Unknown email template." }, { status: 404 });
  }

  if (!isCampaignEmailConfigured()) {
    return NextResponse.json({ error: "Email is not configured." }, { status: 500 });
  }

  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Provide a valid test email address." }, { status: 400 });
    }

    const preview = await previewEmailTemplate(slug);
    const unsubscribeUrl = `${siteConfig.url.replace(/\/$/, "")}/unsubscribe`;
    const result = await sendCampaignEmail({
      to: parsed.data.to,
      subject: `[Test] ${preview.subject}`,
      html: preview.html,
      unsubscribeUrl,
    });

    if (!result.sent) {
      return NextResponse.json({ error: result.error ?? "Test send failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Email template test send failed");
  }
}
