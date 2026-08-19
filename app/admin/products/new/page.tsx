import { ProductEditorForm } from "../../../../components/admin/ProductEditorForm";
import type { Gallery } from "../../../../lib/galleries";
import type { Theme, VariantTemplate } from "../../../../lib/supabase/types";
import { fetchAdminJson } from "../../_lib/fetch-admin";

export default async function AdminNewProductPage() {
  const [variantTemplates, themes, galleries] = await Promise.all([
    fetchAdminJson<VariantTemplate[]>("/api/admin/variant-templates"),
    fetchAdminJson<Theme[]>("/api/admin/themes"),
    fetchAdminJson<Gallery[]>("/api/admin/galleries"),
  ]);
  return (
    <ProductEditorForm
      mode="new"
      variantTemplates={variantTemplates}
      themes={themes}
      galleries={galleries}
    />
  );
}
