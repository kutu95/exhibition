import type { SiteContent } from "./supabase/types";
import type { supabaseAdmin } from "./supabase/admin";

const installationImageContentRows: Array<{
  content_key: string;
  content_value: string;
  content_type: SiteContent["content_type"];
}> = [
  { content_key: "installation_cubarama_image", content_value: "", content_type: "image" },
  { content_key: "installation_captain_godfrey_image", content_value: "", content_type: "image" },
  { content_key: "installation_drift_image", content_value: "", content_type: "image" },
];

/**
 * Ensures installation image keys exist in site_content (e.g. after a deploy
 * where SQL was not run). Inserts are idempotent: only missing keys are added.
 */
type ServiceRoleClient = typeof supabaseAdmin;

export async function backfillMissingInstallationImageRows(
  supabase: ServiceRoleClient,
  existingKeys: Set<string>,
): Promise<boolean> {
  const toInsert = installationImageContentRows.filter((row) => !existingKeys.has(row.content_key));
  if (toInsert.length === 0) {
    return false;
  }
  const { error } = await supabase.from("site_content").insert(toInsert);
  if (error) {
    const isUniqueViolation = "code" in error && (error as { code?: string }).code === "23505";
    if (isUniqueViolation) {
      return true;
    }
    console.error("backfill site_content (installation images)", error);
    return false;
  }
  return true;
}
