import type { Metadata } from "next";
import Link from "next/link";

import { EmailSignupForm } from "../components/EmailSignupForm";
import { HeroVideo } from "../components/HeroVideo";
import { JsonLd } from "../components/JsonLd";
import { awaitPageMetadata, buildPageMetadata } from "../lib/seo-content";
import {
  buildExhibitionEvent,
  buildHomeFaq,
  buildHomeWebPage,
  buildPhotographerPerson,
  buildWebsite,
  HOME_FAQ_ITEMS,
} from "../lib/structured-data";
import { createSupabasePublicClient } from "../lib/supabase/public";
import styles from "./page.module.css";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("home");
}

const contentKeys = ["hero_background_image", "hero_video", "holding_page_body"] as const;

const fallbackHoldingBody =
  "On 1 December 1876, the steamship Georgette foundered off Redgate Beach on the south-west coast of Western Australia. Seven people drowned when the lifeboat capsized. A captain's certificate was suspended. An Aboriginal stockman's courage was written out of the history books. One hundred and fifty years later, John Bowskill returns to the site — to the water, the rock, the sand — with a camera.";

export default async function HomePage() {
  const [, contentResult] = await Promise.all([
    awaitPageMetadata("home"),
    (async () => {
      const supabase = createSupabasePublicClient();
      return supabase
        .from("site_content")
        .select("content_key, content_value")
        .in("content_key", [...contentKeys]);
    })(),
  ]);
  const { data } = contentResult;

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
      <JsonLd data={buildPhotographerPerson()} />
      <JsonLd data={buildExhibitionEvent()} />
      <JsonLd data={buildHomeFaq()} />

      <section className={styles.holding}>
        <HeroVideo
          videoSrc={heroVideoSrc}
          posterSrc={heroPosterSrc}
          headline="The Georgette 150th Anniversary Photographic Exhibition"
          byline="An exhibition by photographer John Bowskill"
          subheadline="Calgardup Bay · Redgate Beach · Isaac Rock · Margaret River, Western Australia"
        />

        <div className={styles.holdingBody}>
          <div className={styles.holdingInner}>
            <p className={styles.lead}>
              John Bowskill is a Margaret River photographer. This photography and immersive historical exhibition
              commemorates 150 years since the sinking of the SS Georgette at Calgardup Bay — Redgate Beach — in
              Western Australia in 1876. The Georgette 150th is part of Margaret River Region Open Studios 2026.
            </p>
            <p className={styles.bodyCopy}>{holdingPageBody}</p>

            <div className={styles.aboutBlock}>
              <p className={styles.aboutEyebrow}>About the exhibition</p>
              <p className={styles.aboutCopy}>
                12–27 September 2026 · Daily 10am–5pm · Free admission
                <br />
                20 Morris Rd, Forest Grove WA 6286 · Margaret River Region Open Studios 2026
              </p>
              <p className={styles.aboutCopy}>
                A photography exhibition with immersive historical installations, limited edition archival prints, and
                coastal work from Calgardup Bay, Redgate Beach, and Isaac Rock.
              </p>
              <nav className={styles.aboutLinks} aria-label="Continue exploring">
                <Link href="/story">The story →</Link>
                <Link href="/book">Author&apos;s preface →</Link>
                <Link href="/visit">Plan your visit →</Link>
                <Link href="/about-the-photographer">About the photographer →</Link>
                <Link href="/shop">Photographs →</Link>
              </nav>
            </div>

            <div className={styles.talkBlock}>
              <p className={styles.aboutEyebrow}>Public talk</p>
              <p className={styles.talkTitle}>Marcia van Zeller — The Truth About the Georgette</p>
              <p className={styles.aboutCopy}>
                Free public talk on Sunday 20 September, 11am–12pm. All welcome.
              </p>
              <Link href="/installations#talk" className={styles.inlineLink}>
                About the talk / reserve a place →
              </Link>
            </div>

            <section className={styles.faqBlock} aria-labelledby="home-faq-heading">
              <h2 id="home-faq-heading" className={styles.aboutEyebrow}>
                Frequently asked questions
              </h2>
              <dl className={styles.faqList}>
                {HOME_FAQ_ITEMS.map((item) => (
                  <div key={item.question} className={styles.faqItem}>
                    <dt className={styles.faqQuestion}>{item.question}</dt>
                    <dd className={styles.faqAnswer}>{item.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <hr className={styles.rule} />

            <p className={styles.signupIntro}>
              Be first to hear about new print releases, exhibition details, and talk reminders.
            </p>
            <div id="holding-signup" className={styles.holdingSignup}>
              <EmailSignupForm source="holding_page" buttonLabel="Keep me informed" />
            </div>
          </div>

          <p className={styles.copyright}>© 2026 · exhibition.margies.app</p>
        </div>
      </section>
    </>
  );
}
