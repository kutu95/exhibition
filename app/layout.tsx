import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ReactNode } from "react";

import { SiteFooter } from "../components/SiteFooter";
import { SiteNav } from "../components/SiteNav";
import { buildMetadata, siteConfig } from "../lib/metadata";
import "./globals.css";

const baseMetadata = buildMetadata({});

export const metadata: Metadata = {
  ...baseMetadata,
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  authors: [{ name: "John Bowskill", url: siteConfig.url }],
  creator: "John Bowskill",
  publisher: "John Bowskill",
  category: "Photography Exhibition",
  keywords: [
    "photography exhibition",
    "Margaret River",
    "Western Australia",
    "SS Georgette",
    "shipwreck",
    "Calgardup Bay",
    "Redgate Beach",
    "Isaac Rock",
    "John Bowskill",
    "Margaret River Region Open Studios",
    "limited edition prints",
    "fine art photography",
    "1876",
    "Grace Bussell",
    "Sam Isaacs",
  ],
  alternates: {
    canonical: siteConfig.url,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a1628",
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
