import type { Metadata } from "next";
import Image from "next/image";

import { EmailSignupForm } from "../components/EmailSignupForm";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://exhibition.margies.app";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Holding page for the SS Georgette photography exhibition, 12-27 September 2026.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/`,
    title: "Where the Georgette Went Down",
    description:
      "A photography exhibition · 12-27 September 2026",
    images: [{ url: "/images/placeholder-og.jpg" }],
  },
};

export default function HomePage() {
  return (
    <section
      data-holding-page="true"
      style={{
        minHeight: "100vh",
        background: "var(--color-navy)",
        color: "var(--color-cream)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Image
        src="/images/holding-bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        style={{ objectFit: "cover", opacity: 0.55 }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to bottom, rgba(10,22,40,0.62) 0%, rgba(10,22,40,0.48) 50%, rgba(10,22,40,0.72) 100%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "560px", margin: "0 auto", width: "100%" }}>
          <p
            style={{
              color: "var(--color-gold)",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              fontSize: "0.7rem",
              margin: 0,
            }}
          >
            Margaret River Region Open Studios
          </p>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(2.8rem, 7vw, 5.5rem)",
              fontWeight: 300,
              color: "var(--color-cream)",
              lineHeight: 1.05,
              margin: "0.7rem 0 0",
            }}
          >
            Where the Georgette
            <br />
            Went Down
          </h1>
          <p style={{ fontSize: "1rem", color: "var(--color-sand)", marginTop: "1rem" }}>
            A photography exhibition · 12-27 September 2026
          </p>

          <hr style={{ border: 0, height: "1px", background: "var(--color-sand)", opacity: 0.3, margin: "2rem 0" }} />

          <p style={{ fontSize: "0.95rem", lineHeight: 1.7, color: "var(--color-sand)", opacity: 0.85 }}>
            On 12 January 1876, the steamship Georgette foundered off Redgate Beach on the south-west
            coast of Western Australia. Seven people drowned. A captain&apos;s reputation was destroyed.
            This exhibition returns to the site — Calgardup Bay, Red Gate Beach, Isaac Rock — one hundred
            and fifty years later.
          </p>

          <hr style={{ border: 0, height: "1px", background: "var(--color-sand)", opacity: 0.3, margin: "2rem 0" }} />

          <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "var(--color-sand)", marginBottom: "0.9rem" }}>
            Be first to hear about the exhibition, new print releases, and a public talk by author Marcia
            van Zeller.
          </p>

          <div className="holding-signup">
            <EmailSignupForm source="holding_page" buttonLabel="Keep me informed" />
          </div>
        </div>

        <p
          style={{
            margin: "2rem 0 0",
            textAlign: "center",
            fontSize: "0.7rem",
            color: "var(--color-sand)",
            opacity: 0.5,
            letterSpacing: "0.04em",
          }}
        >
          © 2026 · exhibition.margies.app
        </p>
      </div>

      <style>{`
        body:has([data-holding-page="true"]) > header {
          display: none !important;
        }

        body:has([data-holding-page="true"]) > main {
          padding-top: 0 !important;
        }

        .holding-signup form {
          width: 100%;
          display: grid;
          gap: 0.8rem;
        }

        .holding-signup form label {
          color: var(--color-sand);
          font-size: 0.72rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .holding-signup form input {
          width: 100%;
          border: 1px solid rgba(245, 240, 232, 0.3);
          background: transparent;
          color: var(--color-cream);
          padding: 0.75rem 1rem;
          border-radius: 0;
        }

        .holding-signup form input::placeholder {
          color: rgba(245, 240, 232, 0.65);
        }

        .holding-signup form input:focus {
          outline: none;
          border-color: var(--color-cream);
        }

        .holding-signup form button {
          width: 100%;
          border: 0;
          border-radius: 0;
          background: var(--color-cream);
          color: var(--color-navy);
          padding: 0.75rem 1.5rem;
          font-family: var(--font-body);
          font-weight: 500;
        }

        .holding-signup form button:hover {
          background: var(--color-sand);
        }

        .holding-signup p {
          color: var(--color-cream);
          margin: 0;
        }
      `}</style>
    </section>
  );
}
