import { headers } from "next/headers";
import { ReactNode } from "react";

import { AdminShell } from "../../components/admin/AdminShell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return <AdminShell>{children}</AdminShell>;
}
