import { ImportPhotoWizardClient } from "../../../components/admin/ImportPhotoWizardClient";
import { getMasterFilesDir, type MasterFileCandidate } from "../../../lib/master-files";
import type { VariantTemplate } from "../../../lib/supabase/types";
import { fetchAdminJson } from "../_lib/fetch-admin";

const resolveMasterFilesDirDisplay = (): string => {
  if (process.env.NODE_ENV !== "production") {
    return "/Volumes/AppData/Exhibition";
  }

  try {
    return getMasterFilesDir();
  } catch {
    return process.env.MASTER_FILES_DIR?.trim() || "(MASTER_FILES_DIR not configured)";
  }
};

export default async function ImportWizardPage() {
  const results = await Promise.allSettled([
    fetchAdminJson<{ files: MasterFileCandidate[] }>("/api/admin/master-files"),
    fetchAdminJson<VariantTemplate[]>("/api/admin/variant-templates"),
  ]);

  const loadErrors: string[] = [];
  let masterFiles: MasterFileCandidate[] = [];
  let variantTemplates: VariantTemplate[] = [];

  if (results[0].status === "fulfilled") {
    masterFiles = results[0].value.files;
  } else {
    const reason = results[0].reason;
    loadErrors.push(
      reason instanceof Error ? reason.message : "Failed to load master TIFF list from MASTER_FILES_DIR.",
    );
  }

  if (results[1].status === "fulfilled") {
    variantTemplates = results[1].value;
  } else {
    const reason = results[1].reason;
    loadErrors.push(
      reason instanceof Error
        ? reason.message
        : "Failed to load print templates. Apply the additive SQL migrations if variant_templates is missing.",
    );
  }

  return (
    <div>
      <h1>Import Photo Wizard</h1>
      <p style={{ maxWidth: "48rem", color: "#555", marginTop: 0 }}>
        Guided steps from master TIFF on the server share to a shop product ready for ordering.
        For a single-screen form, use Register Photo.
      </p>
      <ImportPhotoWizardClient
        initialMasterFiles={masterFiles}
        variantTemplates={variantTemplates}
        masterFilesDirPath={resolveMasterFilesDirDisplay()}
        loadErrors={loadErrors}
      />
    </div>
  );
}
