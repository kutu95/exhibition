import { PrintProfilesClient } from "../../../components/admin/PrintProfilesClient";
import { getOfferPricingBundle } from "../../../lib/print-offer-bundle";
import type { PrintProfile } from "../../../lib/supabase/types";
import { fetchAdminJson } from "../_lib/fetch-admin";

export default async function AdminPrintProfilesPage() {
  const [profiles, pricing] = await Promise.all([
    fetchAdminJson<PrintProfile[]>("/api/admin/print-profiles"),
    getOfferPricingBundle(),
  ]);

  return (
    <div>
      <h1>Print Templates</h1>
      <p>
        Buyer offer pricing: media and frame markups, Pixel Perfect frame/canvas rate tables, reprice, and clean-break
        rebuild of all print options. ICC uploads remain reference-only.
      </p>
      <PrintProfilesClient
        initialProfiles={profiles}
        initialMarkupFactor={pricing.markupFactor}
        initialBasePriceAud={pricing.basePriceAud}
        initialFrameMarkupFactor={pricing.frameMarkupFactor}
        initialFrameBasePriceAud={pricing.frameBasePriceAud}
        initialFrameRates={pricing.frameRates}
        initialRthCanvasRates={pricing.rthCanvasRates}
      />
    </div>
  );
}
