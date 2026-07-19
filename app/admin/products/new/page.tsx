import { ProductEditorForm } from "../../../../components/admin/ProductEditorForm";
import type { Theme, VariantTemplate } from "../../../../lib/supabase/types";
import { fetchAdminJson } from "../../_lib/fetch-admin";

export default async function AdminNewProductPage() {
  const [variantTemplates, themes] = await Promise.all([
    fetchAdminJson<VariantTemplate[]>("/api/admin/variant-templates"),
    fetchAdminJson<Theme[]>("/api/admin/themes"),
  ]);
  return <ProductEditorForm mode="new" variantTemplates={variantTemplates} themes={themes} />;
}
