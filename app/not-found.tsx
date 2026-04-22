import type { Metadata } from "next";
import Link from "next/link";

import { buildMetadata } from "../lib/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Page Not Found",
  noIndex: true,
});

export default function NotFound() {
  return (
    <section
      className="section"
      style={{ background: "var(--color-navy)", color: "var(--color-cream)", minHeight: "70vh" }}
    >
      <div className="container-narrow" style={{ textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-heading)", fontSize: "clamp(4rem, 12vw, 8rem)", margin: 0 }}>
          404
        </p>
        <p style={{ marginTop: 0, marginBottom: "0.4rem", fontSize: "1.15rem" }}>
          The page you&apos;re looking for is somewhere beneath the surface.
        </p>
        <p style={{ marginTop: 0, marginBottom: "1.5rem" }}>
          It may have moved, or it may never have existed. Either way, the coast is still out there.
        </p>
        <Link href="/" className="button-outline" style={{ color: "var(--color-cream)" }}>
          Back to the exhibition →
        </Link>
      </div>
    </section>
  );
}
