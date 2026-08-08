import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ReactNode } from "react";

import { PublicShell } from "../components/PublicShell";
import { buildMetadata, siteConfig } from "../lib/metadata";
import { isPurchasesLanOnlyEnabled } from "../lib/purchases-access";
import "./globals.css";

export const revalidate = 60;

const baseMetadata = buildMetadata({});

export const metadata: Metadata = {
  ...baseMetadata,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  authors: [{ name: "John Bowskill", url: `${siteConfig.url}/about-the-photographer` }],
  creator: "John Bowskill",
  publisher: "John Bowskill",
  category: "Photography Exhibition",
  keywords: [
    "photography exhibition",
    "Margaret River",
    "Western Australia",
    "SS Georgette",
    "Georgette shipwreck",
    "150th anniversary",
    "Calgardup Bay",
    "Redgate Beach",
    "Isaac Rock",
    "John Bowskill",
    "Margaret River Region Open Studios",
    "Margaret River Open Studios 2026",
    "limited edition prints",
    "fine art photography",
    "1876",
    "Grace Bussell",
    "Sam Isaacs",
  ],
};

export const viewport: Viewport = {
  themeColor: "#0a1628",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const purchasesLanOnly = isPurchasesLanOnlyEnabled();
  const isStripeBypassEnabled = ["1", "true", "yes", "on"].includes(
    (process.env.CHECKOUT_BYPASS_STRIPE ?? "").trim().toLowerCase(),
  );

  // Static site name — avoid awaiting Supabase in the root layout so public
  // pages stay ISR-eligible and crawlers get a complete <head>.
  const exhibitionTitle = siteConfig.name;

  return (
    <html lang="en-AU">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,600&family=Inter:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Script
          defer
          data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
          src={`${process.env.NEXT_PUBLIC_PLAUSIBLE_URL}/js/script.tagged-events.js`}
          strategy="afterInteractive"
        />
        {isStripeBypassEnabled ? (
          <div
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 100,
              background: "#7a1400",
              color: "#fff",
              padding: "0.55rem 0.9rem",
              textAlign: "center",
              fontSize: "0.92rem",
              letterSpacing: "0.01em",
            }}
          >
            Stripe bypass is ON. Checkout creates paid test orders directly (no Stripe charge).
          </div>
        ) : null}
        <PublicShell exhibitionTitle={exhibitionTitle} purchasesLanOnly={purchasesLanOnly}>
          {children}
        </PublicShell>
      </body>
    </html>
  );
}
