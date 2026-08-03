"use client";

import { createContext, useContext, type ReactNode } from "react";

const PurchasesAccessContext = createContext(true);

export function PurchasesAccessProvider({
  allowed,
  children,
}: {
  allowed: boolean;
  children: ReactNode;
}) {
  return <PurchasesAccessContext.Provider value={allowed}>{children}</PurchasesAccessContext.Provider>;
}

export function usePurchasesAllowed(): boolean {
  return useContext(PurchasesAccessContext);
}
