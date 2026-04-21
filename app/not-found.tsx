import Link from "next/link";

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
        <p style={{ marginTop: 0, marginBottom: "1.5rem" }}>
          The page you&apos;re looking for is somewhere beneath the surface.
        </p>
        <Link href="/" className="button-outline" style={{ color: "var(--color-cream)" }}>
          Return home
        </Link>
      </div>
    </section>
  );
}
