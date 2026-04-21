"use client";

import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <section
      className="section"
      style={{ background: "var(--color-navy)", color: "var(--color-cream)", minHeight: "70vh" }}
    >
      <div className="container-narrow" style={{ textAlign: "center" }}>
        <p className="eyebrow" style={{ color: "var(--color-gold)" }}>
          Unexpected error
        </p>
        <h1 className="heading-section" style={{ marginTop: 0 }}>
          Something went wrong beneath the surface.
        </h1>
        <p>Try again, or return to the main exhibition page.</p>
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="button-outline" style={{ color: "var(--color-cream)" }} onClick={() => reset()}>
            Try again
          </button>
          <Link href="/" className="button-outline" style={{ color: "var(--color-cream)" }}>
            Go home
          </Link>
        </div>
      </div>
    </section>
  );
}
