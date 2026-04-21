import type { Metadata } from "next";

import { OrderSuccessContent } from "../../../components/OrderSuccessContent";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3007";

export const metadata: Metadata = {
  title: "Order Success",
  description: "Order confirmation for your SS Georgette exhibition purchase.",
  alternates: {
    canonical: "/order/success",
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/order/success`,
    title: "Order Success | SS Georgette Exhibition",
    description: "Order confirmation for your SS Georgette exhibition purchase.",
    images: [{ url: "/images/placeholder-og.jpg" }],
  },
};

export default function OrderSuccessPage() {
  return <OrderSuccessContent />;
}
