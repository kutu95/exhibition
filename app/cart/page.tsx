import type { Metadata } from "next";

import { CartClient } from "../../components/CartClient";
import { buildMetadata } from "../../lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Cart",
  description: "Review prints in your cart before checkout.",
  noIndex: true,
});

export default function CartPage() {
  return (
    <div className="section container">
      <h1>Cart</h1>
      <p>Add prints from the shop, then checkout when you’re ready.</p>
      <CartClient />
    </div>
  );
}
