import { ReactNode } from "react";
import type { Metadata } from "next";

import { AdminShell } from "../../components/admin/AdminShell";
import { buildMetadata } from "../../lib/metadata";

export const metadata: Metadata = {
  ...buildMetadata({
    title: "Admin",
    noIndex: true,
  }),
  icons: {
    icon: [
      { url: "/favicon-admin.ico", sizes: "any" },
      { url: "/favicon-admin-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-admin-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-admin-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/android-chrome-admin-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon-admin.ico",
    apple: [{ url: "/apple-touch-icon-admin.png", sizes: "180x180", type: "image/png" }],
  },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
