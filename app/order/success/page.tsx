import type { Metadata } from "next";

import { OrderSuccessContent } from "../../../components/OrderSuccessContent";
import { OrderSuccessTracker } from "../../../components/OrderSuccessTracker";
import { buildMetadata } from "../../../lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Order Confirmed",
  noIndex: true,
});

export default function OrderSuccessPage() {
  return (
    <>
      <OrderSuccessTracker />
      <OrderSuccessContent />
    </>
  );
}
