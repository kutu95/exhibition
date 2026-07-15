import { RegisterPhotoClient } from "../../../components/admin/RegisterPhotoClient";
import type { MasterFileCandidate } from "../../../lib/master-files";
import type { VariantTemplate } from "../../../lib/supabase/types";
import { fetchAdminJson } from "../_lib/fetch-admin";

export default async function RegisterPhotoPage() {
  const [masterFilesPayload, variantTemplates] = await Promise.all([
    fetchAdminJson<{ files: MasterFileCandidate[] }>("/api/admin/master-files"),
    fetchAdminJson<VariantTemplate[]>("/api/admin/variant-templates"),
  ]);

  return (
    <div>
      <h1>Register Photo</h1>
      <RegisterPhotoClient masterFiles={masterFilesPayload.files} variantTemplates={variantTemplates} />
    </div>
  );
}
