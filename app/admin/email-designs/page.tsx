import Link from "next/link";

import { fetchAdminJson } from "../_lib/fetch-admin";
import type { EmailTemplateDefinition } from "../../../lib/emails/template-defs";
import type { EmailTemplateRecord } from "../../../lib/emails/templates";
import styles from "../admin.module.css";

type TemplatesResponse = {
  templates: Array<EmailTemplateRecord & { definition: EmailTemplateDefinition }>;
};

export default async function AdminEmailDesignsPage() {
  const data = await fetchAdminJson<TemplatesResponse>("/api/admin/email-templates");

  return (
    <div>
      <h1>Email designs</h1>
      <p>Edit the branded emails the site sends automatically. Campaigns (newsletters) stay under Email campaigns.</p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Email</th>
              <th>When it sends</th>
              <th>Subject</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.templates.map((template) => (
              <tr key={template.slug}>
                <td>
                  <Link href={`/admin/email-designs/${template.slug}`}>{template.definition.name}</Link>
                </td>
                <td>{template.definition.description}</td>
                <td>{template.subject || "—"}</td>
                <td>
                  <Link href={`/admin/email-designs/${template.slug}`}>Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
