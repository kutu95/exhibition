import { headers } from "next/headers";
import { ReactNode } from "react";

import { AdminShell } from "../../components/admin/AdminShell";
import { buildMetadata } from "../../lib/metadata";

export const metadata = buildMetadata({
  title: "Admin",
  noIndex: true,
});

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return <AdminShell>{children}</AdminShell>;
}
