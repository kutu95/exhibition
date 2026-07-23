import type { Metadata } from "next";

import { EmailSignupForm } from "../components/EmailSignupForm";
import { HeroVideo } from "../components/HeroVideo";
import { JsonLd } from "../components/JsonLd";
import { buildMetadata, siteConfig } from "../lib/metadata";
import { buildExhibitionEvent } from "../lib/structured-data";
import { createSupabaseServerClient } from "../lib/supabase/server";

const baseMetadata = buildMetadata({
  description: siteConfig.description,
  path: "/",
  ogImage: siteConfig.ogImage.default,
});

export const metadata: Metadata = {
  ...baseMetadata,
  openGraph: {
    ...baseMetadata.openGraph,
    type: "website",
  },
};

const contentKeys = [
  "hero_background_image",
  "hero_video",
  "holding_page_body",
] as const;

const fallbackHoldingBody =
  "On 1 December 1876, the steamship Georgette foundered off Redgate Beach on the south-west coast of Western Australia. Seven people drowned when the lifeboat capsized. A captain's certificate was suspended. An Aboriginal stockman's courage was written out of the history books. One hundred and fifty years later, John Bowskill returns to the site — to the water, the rock, the sand — with a camera.";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("site_content")
    .select("content_key, content_value")
    .in("content_key", [...contentKeys]);

  const contentMap = new Map((data ?? []).map((row) => [row.content_key, row.content_value]) as Array<[string, string | null]>);

  const heroHeadline = "The Georgette 150th";
  const heroSubheadline = "Calgardup Bay · Redgate Beach · Isaac Rock";
  const heroVideoSrc = contentMap.get("hero_video")?.trim() || undefined;
  const heroPosterSrc = contentMap.get("hero_background_image")?.trim() || "/images/holding-bg.jpg";
  const holdingPageBody = contentMap.get("holding_page_body")?.trim() || fallbackHoldingBody;

  return (
    <>
      <JsonLd data={buildExhibitionEvent()} />
      <section data-holding-page="true" style={{ background: "var(--color-navy)", color: "var(--color-cream)" }}>
        <HeroVideo
          videoSrc={heroVideoSrc}
          posterSrc={heroPosterSrc}
          headline={heroHeadline}
          byline="An exhibition by photographer John Bowskill"
          subheadline={heroSubheadline}
        />

        <div
          style={{
            padding: "2.4rem 2rem 3rem",
          }}
        >
          <div style={{ maxWidth: "560px", margin: "0 auto", width: "100%" }}>
            <p style={{ fontSize: "1.05rem", lineHeight: 1.75, color: "var(--color-cream)" }}>
              {holdingPageBody}
            </p>

            <div
              style={{
                border: "1px solid rgba(245, 240, 232, 0.35)",
                padding: "1.4rem 1.5rem",
                margin: "2.2rem 0 0",
              }}
            >
              <p
                style={{
                  margin: "0 0 0.4rem",
                  fontSize: "0.72rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "var(--color-sand)",
                }}
              >
                Public Talk
              </p>
              <p style={{ margin: "0 0 0.5rem", fontSize: "1.05rem", color: "var(--color-cream)" }}>
                Marcia van Zeller — The Truth About the Georgette
              </p>
              <p style={{ margin: "0 0 0.9rem", fontSize: "0.88rem", lineHeight: 1.6, color: "var(--color-sand)" }}>
                The author and historian behind the research into what really happened at Calgardup Bay gives a free
                public talk on Sunday 20 September, 11am–12pm. All welcome.
              </p>
              <a
                href="/installations#talk"
                style={{
                  color: "var(--color-cream)",
                  fontSize: "0.88rem",
                  borderBottom: "1px solid rgba(245, 240, 232, 0.5)",
                  paddingBottom: "0.1rem",
                }}
              >
                About the talk / reserve a place →
              </a>
            </div>

            <hr style={{ border: 0, height: "1px", background: "var(--color-sand)", opacity: 0.3, margin: "2.2rem 0" }} />

            <p style={{ fontSize: "0.85rem", lineHeight: 1.6, color: "var(--color-sand)", marginBottom: "0.9rem" }}>
              Be first to hear about new print releases, exhibition details, and reminders for Marcia van Zeller&apos;s
              talk.
            </p>

            <div id="holding-signup" className="holding-signup">
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
      </section>

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
    </>
  );
}
