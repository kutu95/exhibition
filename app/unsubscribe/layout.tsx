import type { Metadata } from "next";
import type { ReactNode } from "react";

import { buildMetadata } from "../../lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Unsubscribe",
  description: "Unsubscribe from The Georgette 150th exhibition emails.",
  path: "/unsubscribe",
  noIndex: true,
});

export default function UnsubscribeLayout({ children }: { children: ReactNode }) {
  return children;
}
