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
  const [masterFilesPayload, variantTemplates] = await Promise.all([
    fetchAdminJson<{ files: MasterFileCandidate[] }>("/api/admin/master-files"),
    fetchAdminJson<VariantTemplate[]>("/api/admin/variant-templates"),
  ]);

  return (
    <div>
      <h1>Import Photo Wizard</h1>
      <p style={{ maxWidth: "48rem", color: "#555", marginTop: 0 }}>
        Guided steps from master TIFF on the server share to a shop product ready for ordering.
        For a single-screen form, use Register Photo.
      </p>
      <ImportPhotoWizardClient
        initialMasterFiles={masterFilesPayload.files}
        variantTemplates={variantTemplates}
        masterFilesDirPath={resolveMasterFilesDirDisplay()}
      />
    </div>
  );
}
