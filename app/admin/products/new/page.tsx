import { ProductEditorForm } from "../../../../components/admin/ProductEditorForm";
import type { VariantTemplate } from "../../../../lib/supabase/types";
import { fetchAdminJson } from "../../_lib/fetch-admin";

export default async function AdminNewProductPage() {
  const variantTemplates = await fetchAdminJson<VariantTemplate[]>("/api/admin/variant-templates");
  return <ProductEditorForm mode="new" variantTemplates={variantTemplates} />;
}
