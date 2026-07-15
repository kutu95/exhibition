import { PrintProfilesClient } from "../../../components/admin/PrintProfilesClient";
import type { PrintProfile, VariantTemplate } from "../../../lib/supabase/types";
import { fetchAdminJson } from "../_lib/fetch-admin";

export default async function AdminPrintProfilesPage() {
  const [profiles, variantTemplates] = await Promise.all([
    fetchAdminJson<PrintProfile[]>("/api/admin/print-profiles"),
    fetchAdminJson<VariantTemplate[]>("/api/admin/variant-templates"),
  ]);

  return (
    <div>
      <h1>Print Templates</h1>
      <p>Manage sale templates for size, paper, medium, and default pricing. ICC uploads are optional reference metadata.</p>
      <PrintProfilesClient initialProfiles={profiles} initialVariantTemplates={variantTemplates} />
    </div>
  );
}
