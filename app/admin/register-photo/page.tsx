import { RegisterPhotoClient } from "../../../components/admin/RegisterPhotoClient";
import type { MasterFileCandidate } from "../../../lib/master-files";
import type { VariantTemplate } from "../../../lib/supabase/types";
import { fetchAdminJson } from "../_lib/fetch-admin";

export default async function RegisterPhotoPage() {
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
      <h1>Register Photo</h1>
      {loadErrors.length > 0 ? (
        <div
          style={{
            background: "#fff8f6",
            border: "1px solid #e8b4a8",
            color: "#7a2e1f",
            marginBottom: "1rem",
            padding: "0.75rem 0.9rem",
            maxWidth: "48rem",
          }}
        >
          <strong>Could not load registration data</strong>
          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.2rem" }}>
            {loadErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <RegisterPhotoClient masterFiles={masterFiles} variantTemplates={variantTemplates} />
    </div>
  );
}
