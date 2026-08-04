import { redirect } from "next/navigation";

/** Legacy Register Photo (template-based) is retired — use the Import Wizard offer matrix. */
export default function RegisterPhotoPage() {
  redirect("/admin/import-wizard");
}
