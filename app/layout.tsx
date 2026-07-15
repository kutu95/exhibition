import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { ReactNode } from "react";

import { SiteFooter } from "../components/SiteFooter";
import { SiteNav } from "../components/SiteNav";
import { buildMetadata, siteConfig } from "../lib/metadata";
import { createSupabaseServerClient } from "../lib/supabase/server";
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
  const isStripeBypassEnabled = ["1", "true", "yes", "on"].includes(
    (process.env.CHECKOUT_BYPASS_STRIPE ?? "").trim().toLowerCase(),
  );

  let exhibitionTitle = siteConfig.name;
  if (!isAdminRoute) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("site_content")
      .select("content_value")
      .eq("content_key", "hero_headline")
      .maybeSingle();
    const headline = data?.content_value?.trim();
    if (headline) {
      exhibitionTitle = headline;
    }
  }

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
        <Script
          defer
          data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
          src={`${process.env.NEXT_PUBLIC_PLAUSIBLE_URL}/js/script.tagged-events.js`}
          strategy="afterInteractive"
        />
        {isStripeBypassEnabled ? (
          <div
            style={{
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
        {!isAdminRoute ? <SiteNav exhibitionTitle={exhibitionTitle} /> : null}
        <main style={{ minHeight: "100vh", paddingTop: isAdminRoute ? "0" : "78px" }}>{children}</main>
        {!isAdminRoute ? <SiteFooter exhibitionTitle={exhibitionTitle} /> : null}
      </body>
    </html>
  );
}
