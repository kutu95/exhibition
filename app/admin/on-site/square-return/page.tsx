import { Suspense } from "react";

import { SquareReturnClient } from "./SquareReturnClient";

export const dynamic = "force-dynamic";

export default function AdminOnSiteSquareReturnPage() {
  return (
    <Suspense fallback={<p>Completing Square payment…</p>}>
      <SquareReturnClient />
    </Suspense>
  );
}
