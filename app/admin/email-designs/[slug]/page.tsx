import { notFound } from "next/navigation";

import { EmailTemplateEditorClient } from "../../../../components/admin/EmailTemplateEditorClient";
import { isEmailTemplateSlug } from "../../../../lib/emails/template-defs";
import type { EmailTemplateDefinition } from "../../../../lib/emails/template-defs";
import type { EmailTemplateRecord } from "../../../../lib/emails/templates";
import { fetchAdminJson } from "../../_lib/fetch-admin";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type TemplateResponse = {
  template: EmailTemplateRecord;
  definition: EmailTemplateDefinition;
};

export default async function AdminEmailDesignEditPage({ params }: PageProps) {
  const { slug } = await params;
  if (!isEmailTemplateSlug(slug)) {
    notFound();
  }

  let detail: TemplateResponse;
  try {
    detail = await fetchAdminJson<TemplateResponse>(`/api/admin/email-templates/${slug}`);
  } catch {
    notFound();
  }

  return <EmailTemplateEditorClient template={detail.template} definition={detail.definition} />;
}
