import type { Metadata } from "next";
import { cookies } from "next/headers";

import { CartClient } from "../../components/CartClient";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "../../lib/admin-auth";
import { buildMetadata } from "../../lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Cart",
  description: "Review prints in your cart before checkout.",
  path: "/cart",
  noIndex: true,
});

export default async function CartPage() {
  const cookieStore = await cookies();
  const isAdmin = await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  return (
    <div className="section container">
      <h1>Cart</h1>
      <p>
        {isAdmin
          ? "Add prints from the shop, then take payment at the desk or check out with Stripe."
          : "Add prints from the shop, then checkout when you’re ready."}
      </p>
      <CartClient isAdmin={isAdmin} />
    </div>
  );
}
