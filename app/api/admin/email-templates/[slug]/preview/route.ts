import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../../lib/api-route-errors";
import { isEmailTemplateSlug } from "../../../../../../lib/emails/template-defs";
import { previewEmailTemplate } from "../../../../../../lib/emails/templates";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;
  if (!isEmailTemplateSlug(slug)) {
    return NextResponse.json({ error: "Unknown email template." }, { status: 404 });
  }

  try {
    const preview = await previewEmailTemplate(slug);
    return NextResponse.json(preview);
  } catch (error) {
    return handleRouteError(error, "Email template preview failed");
  }
}
