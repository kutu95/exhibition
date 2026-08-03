import { PrintProfilesClient } from "../../../components/admin/PrintProfilesClient";
import { getPrintPriceMarkupFactor } from "../../../lib/print-markup";
import type { PrintProfile, VariantTemplate } from "../../../lib/supabase/types";
import { fetchAdminJson } from "../_lib/fetch-admin";

export default async function AdminPrintProfilesPage() {
  const [profiles, variantTemplates, markupFactor] = await Promise.all([
    fetchAdminJson<PrintProfile[]>("/api/admin/print-profiles"),
    fetchAdminJson<VariantTemplate[]>("/api/admin/variant-templates"),
    getPrintPriceMarkupFactor(),
  ]);

  return (
    <div>
      <h1>Print Templates</h1>
      <p>
        Set the global retail markup, manage optional ISO sale templates, and keep ICC uploads as reference metadata.
        New imports price from paper × long edge using square-inch lab cost × markup.
      </p>
      <PrintProfilesClient
        initialProfiles={profiles}
        initialVariantTemplates={variantTemplates}
        initialMarkupFactor={markupFactor}
      />
    </div>
  );
}
