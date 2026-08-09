import { Suspense } from "react";

import { OnSiteSaleClient } from "../../../components/admin/OnSiteSaleClient";
import { isSquarePosConfigured } from "../../../lib/square-pos";

export const dynamic = "force-dynamic";

export default function AdminOnSiteSalePage() {
  return (
    <Suspense fallback={<p>Loading on-site sale…</p>}>
      <OnSiteSaleClient squareConfigured={isSquarePosConfigured()} />
    </Suspense>
  );
}
