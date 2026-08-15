import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyAdminSession } from "../../../../../lib/admin-auth";
import { handleRouteError } from "../../../../../lib/api-route-errors";
import { campaignBlocksSchema } from "../../../../../lib/campaigns/blocks";
import { getEmailTemplate, updateEmailTemplate } from "../../../../../lib/emails/templates";
import { EMAIL_TEMPLATE_DEFINITIONS, isEmailTemplateSlug } from "../../../../../lib/emails/template-defs";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

const patchSchema = z.object({
  subject: z.string().max(300).optional(),
  preview_text: z.string().max(500).nullable().optional(),
  blocks: campaignBlocksSchema.optional(),
});

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
    const template = await getEmailTemplate(slug);
    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }
    return NextResponse.json({
      template,
      definition: EMAIL_TEMPLATE_DEFINITIONS[slug],
    });
  } catch (error) {
    return handleRouteError(error, "Email template get failed");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const isAuthed = await verifyAdminSession(request);
  if (!isAuthed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await context.params;
  if (!isEmailTemplateSlug(slug)) {
    return NextResponse.json({ error: "Unknown email template." }, { status: 404 });
  }

  try {
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid template update." }, { status: 400 });
    }
    const template = await updateEmailTemplate(slug, parsed.data);
    return NextResponse.json({ template, definition: EMAIL_TEMPLATE_DEFINITIONS[slug] });
  } catch (error) {
    return handleRouteError(error, "Email template update failed");
  }
}
