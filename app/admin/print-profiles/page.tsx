import { PrintProfilesClient } from "../../../components/admin/PrintProfilesClient";
import { getPrintPricingBundle } from "../../../lib/print-papers";
import type { PrintProfile, VariantTemplate } from "../../../lib/supabase/types";
import { fetchAdminJson } from "../_lib/fetch-admin";

export default async function AdminPrintProfilesPage() {
  const [profiles, variantTemplates, pricing] = await Promise.all([
    fetchAdminJson<PrintProfile[]>("/api/admin/print-profiles"),
    fetchAdminJson<VariantTemplate[]>("/api/admin/variant-templates"),
    getPrintPricingBundle(),
  ]);

  return (
    <div>
      <h1>Print Templates</h1>
      <p>
        Set base price, markup, and paper rates; manage optional ISO sale templates; keep ICC uploads as reference
        metadata. Suggested retail is roundUp(base + markup × area × rate/sq in).
      </p>
      <PrintProfilesClient
        initialProfiles={profiles}
        initialVariantTemplates={variantTemplates}
        initialMarkupFactor={pricing.markupFactor}
        initialBasePriceAud={pricing.basePriceAud}
        initialPapers={pricing.papers}
      />
    </div>
  );
}
