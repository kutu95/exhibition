import { NextResponse } from "next/server";

import { verifyAdminSession } from "../../../../lib/admin-auth";
import { handleRouteError } from "../../../../lib/api-route-errors";
import { ensureEmailTemplates } from "../../../../lib/emails/templates";
import { EMAIL_TEMPLATE_DEFINITIONS } from "../../../../lib/emails/template-defs";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const templates = await ensureEmailTemplates();
    return NextResponse.json({
      templates: templates.map((template) => ({
        ...template,
        definition: EMAIL_TEMPLATE_DEFINITIONS[template.slug],
      })),
    });
  } catch (error) {
    return handleRouteError(error, "Email templates list failed");
  }
}
