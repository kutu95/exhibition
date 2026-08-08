"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { arePurchasesAllowedForHost } from "../lib/purchases-access";
import { CartProvider } from "./CartProvider";
import { FavouritesProvider } from "./FavouritesProvider";
import { PurchasesAccessProvider } from "./PurchasesAccessProvider";
import { SiteFooter } from "./SiteFooter";
import { SiteNav } from "./SiteNav";

type PublicShellProps = {
  children: ReactNode;
  exhibitionTitle: string;
  purchasesLanOnly: boolean;
};

/**
 * Client shell so the root layout never calls `headers()` / `cookies()`.
 * That keeps public routes eligible for ISR. Admin routes skip the public chrome.
 */
export function PublicShell({
  children,
  exhibitionTitle,
  purchasesLanOnly,
}: PublicShellProps) {
  const pathname = usePathname() ?? "";
  const isAdminRoute = pathname.startsWith("/admin");
  const [purchasesAllowed, setPurchasesAllowed] = useState(!purchasesLanOnly);

  useEffect(() => {
    if (!purchasesLanOnly) {
      setPurchasesAllowed(true);
      return;
    }
    setPurchasesAllowed(arePurchasesAllowedForHost(window.location.host));
  }, [purchasesLanOnly]);

  if (isAdminRoute) {
    return <main style={{ minHeight: "100vh", paddingTop: 0 }}>{children}</main>;
  }

  return (
    <PurchasesAccessProvider allowed={purchasesAllowed}>
      <CartProvider>
        <FavouritesProvider>
          <SiteNav exhibitionTitle={exhibitionTitle} />
          <main style={{ minHeight: "100vh", paddingTop: "78px" }}>{children}</main>
          <SiteFooter exhibitionTitle={exhibitionTitle} showCollectionsCta={purchasesAllowed} />
        </FavouritesProvider>
      </CartProvider>
    </PurchasesAccessProvider>
  );
}
