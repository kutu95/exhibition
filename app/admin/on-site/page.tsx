import { Suspense } from "react";

import { OnSiteSaleClient } from "../../../components/admin/OnSiteSaleClient";
import { CartProvider } from "../../../components/CartProvider";
import { isSquarePosConfigured } from "../../../lib/square-pos";

export const dynamic = "force-dynamic";

export default function AdminOnSiteSalePage() {
  return (
    <CartProvider>
      <Suspense fallback={<p>Loading on-site sale…</p>}>
        <OnSiteSaleClient squareConfigured={isSquarePosConfigured()} />
      </Suspense>
    </CartProvider>
  );
}
