import type { Metadata } from "next";
import Link from "next/link";

import { EmailSignupForm } from "../components/EmailSignupForm";
import { FadeInSection } from "../components/FadeInSection";
import { HeroVideo } from "../components/HeroVideo";
import { JsonLd } from "../components/JsonLd";
import { buildMetadata, siteConfig } from "../lib/metadata";
import {
  buildExhibitionEvent,
  buildHomeFaq,
  buildHomeWebPage,
  buildWebsite,
} from "../lib/structured-data";
import { createSupabaseServerClient } from "../lib/supabase/server";
import styles from "./page.module.css";

export const metadata: Metadata = buildMetadata({
  absoluteTitle: "SS Georgette 150th Anniversary Photographic Exhibition | John Bowskill",
  description:
    "Discover John Bowskill’s photographic exhibition commemorating the 150th anniversary of the SS Georgette shipwreck at Redgate Beach near Margaret River, Western Australia.",
  path: "/",
  ogImage: siteConfig.ogImage.default,
});

const contentKeys = ["hero_background_image", "hero_video", "holding_page_body"] as const;

const fallbackHoldingBody =
  "On 1 December 1876, the steamship Georgette foundered off Redgate Beach on the south-west coast of Western Australia. Seven people drowned when the lifeboat capsized. A captain's certificate was suspended. An Aboriginal stockman's courage was written out of the history books. One hundred and fifty years later, John Bowskill returns to the site — to the water, the rock, the sand — with a camera.";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("site_content")
    .select("content_key, content_value")
    .in("content_key", [...contentKeys]);

  const contentMap = new Map(
    (data ?? []).map((row) => [row.content_key, row.content_value]) as Array<[string, string | null]>,
  );

  const heroVideoSrc = contentMap.get("hero_video")?.trim() || undefined;
  const heroPosterSrc = contentMap.get("hero_background_image")?.trim() || "/images/holding-bg.jpg";
  const holdingPageBody = contentMap.get("holding_page_body")?.trim() || fallbackHoldingBody;

  return (
    <>
      <JsonLd data={buildWebsite()} />
      <JsonLd data={buildHomeWebPage()} />
      <JsonLd data={buildExhibitionEvent()} />
      <JsonLd data={buildHomeFaq()} />

      <HeroVideo
        videoSrc={heroVideoSrc}
        posterSrc={heroPosterSrc}
        headline="SS Georgette 150th Anniversary Photographic Exhibition"
        byline="An exhibition by photographer John Bowskill"
        subheadline="Calgardup Bay · Redgate Beach · Isaac Rock · Margaret River, Western Australia"
      />

      <section className={`section container ${styles.introSection}`}>
        <FadeInSection className={styles.story}>
          <p className="eyebrow">Margaret River Region Open Studios 2026</p>
          <h2 className="heading-section">About the exhibition</h2>
          <p>
            Photographer John Bowskill presents The Georgette 150th — a photographic exhibition commemorating the 150th
            anniversary of the wreck of the SS Georgette at Redgate Beach near Margaret River, Western Australia. The
            work returns to the coast where the steamship foundered, and to the places that still carry that history:
            Calgardup Bay, Redgate Beach, and Isaac Rock.
          </p>
          <p>{holdingPageBody}</p>
          <p>
            The exhibition runs from 12 to 27 September 2026 as part of Margaret River Region Open Studios 2026, at 20
            Morris Rd, Forest Grove WA 6286. Admission is free. Limited edition archival prints from the series are
            available to purchase online and at the exhibition.
          </p>
          <p>
            <Link href="/about-the-photographer" className="text-link">
              About the photographer, John Bowskill →
            </Link>
          </p>
        </FadeInSection>
      </section>

      <section className={`section container ${styles.story}`}>
        <FadeInSection>
          <h2 className="heading-section">The story of the SS Georgette</h2>
          <p>
            On 1 December 1876, the iron screw-steamer SS Georgette foundered off the south-west coast of Western
            Australia. Passengers and crew were forced toward shore in darkness; the lifeboat capsized, and people
            drowned. The aftermath left a contested marine inquiry, a suspended captain&apos;s certificate, and a rescue
            story that history long told incompletely — especially regarding Aboriginal stockman Sam Isaacs and Grace
            Bussell.
          </p>
          <p>
            The wreck lies a few metres beneath the surface of Calgardup Bay, just off Redgate Beach. On a calm day its
            shadow can be seen from the shore. Most days it cannot. The photographs in this exhibition are made at and
            around those places — not as reconstructions of 1876, but as contemporary images of a coastline that still
            holds the event.
          </p>
          <p>
            <Link href="/story" className="text-link">
              Read the full story of the Georgette →
            </Link>
          </p>
        </FadeInSection>
      </section>

      <section className={`section container ${styles.story}`}>
        <FadeInSection>
          <h2 className="heading-section">Why Redgate Beach matters</h2>
          <p>
            Redgate Beach and neighbouring Calgardup Bay are the shoreline against which the Georgette came to grief.
            Isaac Rock sits in the same coastal landscape. For visitors to Margaret River, these names may already mean
            surfing, cliffs, and wild weather. For this exhibition they are also the geography of a maritime disaster
            and of the people who lived its consequences.
          </p>
          <p>
            John Bowskill has spent years photographing these locations. The history is in the landscape: light on
            water, rock platforms, and the particular weather of Western Australia&apos;s south-west cape.
          </p>
        </FadeInSection>
      </section>

      <section className={`section container ${styles.story}`}>
        <FadeInSection>
          <h2 className="heading-section">The photographic approach</h2>
          <p>
            The Georgette 150th brings together still photographs from the exhibition sites with immersive
            installations — including Cubarama, Captain Godfrey AI, and Drift — so visitors can move between looking at
            the coast and encountering the story in other forms.
          </p>
          <p>
            Wall-hung prints from the Calgardup Bay, Redgate Beach, and Isaac Rock series are shown in the gallery and
            offered as limited edition archival prints, signed and numbered by John Bowskill.
          </p>
          <p>
            <Link href="/shop" className="text-link">
              Browse the photographs →
            </Link>
            {" · "}
            <Link href="/installations" className="text-link">
              Explore the installations →
            </Link>
          </p>
        </FadeInSection>
      </section>

      <section className={`section container ${styles.story}`}>
        <FadeInSection>
          <h2 className="heading-section">Exhibition dates and venue</h2>
          <p>
            <strong>The Georgette 150th</strong>
            <br />
            20 Morris Rd, Forest Grove WA 6286
            <br />
            Open daily 10am–5pm, 12–27 September 2026
            <br />
            Free admission · Part of Margaret River Region Open Studios 2026
          </p>
          <p>
            Forest Grove sits in the Margaret River region of Western Australia, roughly three hours south of Perth by
            car. Free on-site parking is available.
          </p>
          <p>
            <Link href="/visit" className="text-link">
              Plan your visit →
            </Link>
          </p>
        </FadeInSection>
      </section>

      <section className={`section container ${styles.story}`}>
        <FadeInSection>
          <h2 className="heading-section">Margaret River Open Studios 2026</h2>
          <p>
            The Georgette 150th is presented during Margaret River Region Open Studios 2026 — a region-wide open studios
            event across the Margaret River, Augusta, and Busselton areas each September. The exhibition offers a
            focused encounter with one local maritime story through photography and installation, within that broader
            Open Studios programme.
          </p>
        </FadeInSection>
      </section>

      <section className={`section container ${styles.story}`}>
        <FadeInSection>
          <h2 className="heading-section">About John Bowskill</h2>
          <p>
            John Bowskill is the photographer behind The Georgette 150th. He has spent the past eight years
            photographing Calgardup Bay, Redgate Beach, Isaac Rock, and the wreck site as the foundation of this
            exhibition.
          </p>
          <p>
            <Link href="/about-the-photographer" className="text-link">
              More about the photographer →
            </Link>
          </p>
        </FadeInSection>
      </section>

      <section className={`section container ${styles.story}`}>
        <FadeInSection>
          <h2 className="heading-section">Public talk</h2>
          <p>
            Author and researcher Marcia van Zeller — whose work on the Georgette informed her doctoral novel — gives a
            free public talk, <em>The Truth About the Georgette</em>, on Sunday 20 September from 11am to midday. All
            welcome. Free places can be reserved on the website.
          </p>
          <p>
            <Link href="/installations#talk" className="text-link">
              About the talk / reserve a place →
            </Link>
          </p>
        </FadeInSection>
      </section>

      <section className={`section container ${styles.faq}`}>
        <FadeInSection>
          <h2 className="heading-section">Frequently asked questions</h2>
          <div className={styles.faqItem}>
            <h3>Where is the exhibition?</h3>
            <p>20 Morris Rd, Forest Grove WA 6286, in the Margaret River region of Western Australia.</p>
          </div>
          <div className={styles.faqItem}>
            <h3>When is it open?</h3>
            <p>Daily from 10am to 5pm, 12–27 September 2026, during Margaret River Region Open Studios 2026.</p>
          </div>
          <div className={styles.faqItem}>
            <h3>Is admission free?</h3>
            <p>Yes. Admission to The Georgette 150th is free.</p>
          </div>
          <div className={styles.faqItem}>
            <h3>Can I buy the photographs?</h3>
            <p>
              Yes. Limited edition archival prints by John Bowskill are available{" "}
              <Link href="/shop" className="text-link">
                in the shop
              </Link>{" "}
              and at the exhibition.
            </p>
          </div>
          <div className={styles.faqItem}>
            <h3>What is the SS Georgette?</h3>
            <p>
              The SS Georgette was a steamship that foundered off Redgate Beach on 1 December 1876. This exhibition
              marks 150 years since that wreck through photography made at the related coastal sites.
            </p>
          </div>
        </FadeInSection>
      </section>

      <section className={`section ${styles.newsletter}`}>
        <div className={`container ${styles.newsletterWrap}`}>
          <h2 className="heading-section">Stay informed</h2>
          <p>
            Be first to hear about new print releases, exhibition details, and reminders for Marcia van Zeller&apos;s
            talk.
          </p>
          <div className={styles.newsletterCard}>
            <EmailSignupForm source="holding_page" buttonLabel="Keep me informed" />
          </div>
        </div>
      </section>
    </>
  );
}
