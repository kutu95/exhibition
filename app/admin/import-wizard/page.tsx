import { ImportPhotoWizardClient } from "../../../components/admin/ImportPhotoWizardClient";
import { getMasterFilesDir, type MasterFileCandidate } from "../../../lib/master-files";
import {
  DEFAULT_PRINT_PRICE_BASE_AUD,
  DEFAULT_PRINT_PRICE_MARKUP_FACTOR,
} from "../../../lib/print-markup";
import { getPrintPricingBundle } from "../../../lib/print-papers";
import { seedManagedPapers } from "../../../lib/print-catalogue";
import type { Theme } from "../../../lib/supabase/types";
import { fetchAdminJson } from "../_lib/fetch-admin";

const resolveMasterFilesDirDisplay = (): string => {
  try {
    return getMasterFilesDir();
  } catch {
    return (
      process.env.MASTER_FILES_DIR_DEV?.trim() ||
      process.env.MASTER_FILES_DIR?.trim() ||
      "(MASTER_FILES_DIR not configured)"
    );
  }
};

export default async function ImportWizardPage() {
  const results = await Promise.allSettled([
    fetchAdminJson<{ files: MasterFileCandidate[] }>("/api/admin/master-files"),
    fetchAdminJson<Theme[]>("/api/admin/themes"),
    getPrintPricingBundle(),
  ]);

  const loadErrors: string[] = [];
  let masterFiles: MasterFileCandidate[] = [];
  let themes: Theme[] = [];
  let markupFactor = DEFAULT_PRINT_PRICE_MARKUP_FACTOR;
  let basePriceAud = DEFAULT_PRINT_PRICE_BASE_AUD;
  let papers = seedManagedPapers();

  if (results[0].status === "fulfilled") {
    masterFiles = results[0].value.files;
  } else {
    const reason = results[0].reason;
    loadErrors.push(
      reason instanceof Error ? reason.message : "Failed to load master TIFF list from MASTER_FILES_DIR.",
    );
  }

  if (results[1].status === "fulfilled") {
    themes = results[1].value;
  } else {
    const reason = results[1].reason;
    loadErrors.push(reason instanceof Error ? reason.message : "Failed to load themes.");
  }

  if (results[2].status === "fulfilled") {
    markupFactor = results[2].value.markupFactor;
    basePriceAud = results[2].value.basePriceAud;
    papers = results[2].value.papers;
  }

  return (
    <div>
      <h1>Import Photo Wizard</h1>
      <p style={{ maxWidth: "48rem", color: "#555", marginTop: 0 }}>
        Guided steps from master TIFF on the server share to a shop product ready for ordering. Print sizes are built
        as aspect-true custom paper (paper × long edge) with square-inch retail pricing.
      </p>
      <ImportPhotoWizardClient
        initialMasterFiles={masterFiles}
        themes={themes}
        masterFilesDirPath={resolveMasterFilesDirDisplay()}
        initialMarkupFactor={markupFactor}
        initialBasePriceAud={basePriceAud}
        initialPapers={papers}
        loadErrors={loadErrors}
      />
    </div>
  );
}
