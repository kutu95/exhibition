import { ReactNode } from "react";

import { AdminShell } from "../../components/admin/AdminShell";
import { buildMetadata } from "../../lib/metadata";

export const metadata = buildMetadata({
  title: "Admin",
  noIndex: true,
});

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
