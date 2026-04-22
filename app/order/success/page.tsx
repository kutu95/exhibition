import type { Metadata } from "next";

import { OrderSuccessContent } from "../../../components/OrderSuccessContent";
import { buildMetadata } from "../../../lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Order Confirmed",
  noIndex: true,
});

export default function OrderSuccessPage() {
  return <OrderSuccessContent />;
}
