import type { Metadata } from "next";
import { headers } from "next/headers";
import { ReactNode } from "react";

import { SiteFooter } from "../components/SiteFooter";
import { SiteNav } from "../components/SiteNav";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3007";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SS Georgette — Margaret River Region Open Studios 2026",
    template: "%s | SS Georgette Exhibition",
  },
  description:
    "A fine art photography exhibition tracing the SS Georgette wreck and coastal memory in Margaret River Region Open Studios, 12-27 September 2026.",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "SS Georgette — Margaret River Region Open Studios 2026",
    description:
      "A fine art photography exhibition tracing the SS Georgette wreck and coastal memory in Margaret River Region Open Studios, 12-27 September 2026.",
    images: [{ url: "/images/placeholder-og.jpg" }],
  },
  alternates: {
    canonical: "/",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isAdminRoute = pathname.startsWith("/admin");

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,600&family=Inter:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {!isAdminRoute ? <SiteNav /> : null}
        <main style={{ minHeight: "100vh", paddingTop: isAdminRoute ? "0" : "78px" }}>{children}</main>
        {!isAdminRoute ? <SiteFooter /> : null}
      </body>
    </html>
  );
}
