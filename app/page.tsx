import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { EmailSignupForm } from "../components/EmailSignupForm";
import { HeroVideo } from "../components/HeroVideo";
import { JsonLd } from "../components/JsonLd";
import { awaitPageMetadata, buildPageMetadata } from "../lib/seo-content";
import {
  buildExhibitionEvent,
  buildHomeFaq,
  buildHomeWebPage,
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

type FeaturedPrint = {
  slug: string;
  title: string;
  location_tag: string | null;
  image_url: string;
  alt_text: string | null;
};

type ProductImageRow = {
  image_url: string | null;
  alt_text: string | null;
  is_primary: boolean | null;
  sort_order: number | null;
};

type FeaturedProductRow = {
  slug: string;
  title: string;
  location_tag: string | null;
  product_images: ProductImageRow[] | ProductImageRow | null;
};

function pickPrimaryImage(images: FeaturedProductRow["product_images"]): ProductImageRow | null {
  const list = Array.isArray(images) ? images : images ? [images] : [];
  const withUrl = list.filter((image) => image.image_url?.trim());
  if (withUrl.length === 0) return null;
  return (
    withUrl.find((image) => image.is_primary) ??
    [...withUrl].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ??
    null
  );
}

async function loadFeaturedPrints(): Promise<FeaturedPrint[]> {
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug, title, location_tag, product_images(image_url, alt_text, is_primary, sort_order)")
    .eq("is_available", true)
    .eq("visibility", "public")
    .eq("product_type", "print")
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);

  if (error || !data) {
    console.warn("[home] Featured prints query failed", error?.message);
    return [];
  }

  return (data as FeaturedProductRow[])
    .flatMap((row) => {
      const image = pickPrimaryImage(row.product_images);
      if (!image?.image_url) return [];
      return [
        {
          slug: row.slug,
          title: row.title,
          location_tag: row.location_tag,
          image_url: image.image_url,
          alt_text: image.alt_text,
        },
      ];
    })
    .slice(0, 3);
}

/** Time-boxed so a slow catalogue query cannot delay the crawler HTML. */
async function getFeaturedPrints(): Promise<FeaturedPrint[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<FeaturedPrint[]>((resolve) => {
    timer = setTimeout(() => resolve([]), 1200);
  });
  try {
    return await Promise.race([loadFeaturedPrints(), timeout]);
  } catch (err) {
    console.warn("[home] Featured prints unavailable", err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export default async function HomePage() {
  const [, contentResult, featuredPrints] = await Promise.all([
    awaitPageMetadata("home"),
    (async () => {
      const supabase = createSupabasePublicClient();
      return supabase
        .from("site_content")
        .select("content_key, content_value")
        .in("content_key", [...contentKeys]);
    })(),
    getFeaturedPrints(),
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
              Photographer John Bowskill presents The Georgette 150th — a photographic exhibition commemorating the
              150th anniversary of the wreck of the SS Georgette at Redgate Beach near Margaret River, Western
              Australia.
            </p>
            <p className={styles.bodyCopy}>{holdingPageBody}</p>

            <section className={styles.proseBlock} aria-labelledby="home-wreck-heading">
              <h2 id="home-wreck-heading" className={styles.sectionHeading}>
                The wreck at Calgardup Bay
              </h2>
              <p>
                The Georgette left Fremantle on 29 November 1876 as an iron screw-steamer under sail and steam, three
                years into colonial service, carrying passengers and a cargo of jarrah south toward Adelaide. By the
                evening of 30 November, rounding Cape Naturaliste, she had begun to leak. Overnight the pumps failed.
                Near dawn on 1 December the rising water put out the boiler fires, and Captain John Godfrey turned the
                ship for shore.
              </p>
              <p>
                In the darkness the lifeboat was launched with the women and children. Ordered to slack the painter and
                drift clear, she was lifted under the ship&apos;s counter, stove in against the iron plating, and
                capsized. Seven people drowned — two women and five children. The Georgette grounded in Calgardup Bay
                that afternoon. Those who made the beach did so by remaining boats, by a rope hauled to the sand, or by
                swimming.
              </p>
              <p>
                Grace Bussell, sixteen, and Sam Isaacs, an Aboriginal stockman employed by her family, rode down through
                the dunes. The press made Grace into the colony&apos;s Grace Darling. Isaacs received a smaller medal and,
                in most tellings since, a supporting role. The exhibition is made at the places that still hold that
                argument: the bay, the beach, and the rock that now carries his name.
              </p>
              <p>
                <Link href="/story" className={styles.inlineLink}>
                  Read the full story of the Georgette →
                </Link>
              </p>
            </section>

            <section className={styles.proseBlock} aria-labelledby="home-photographs-heading">
              <h2 id="home-photographs-heading" className={styles.sectionHeading}>
                Photographs of the wreck coast
              </h2>
              <p>
                The prints are not reconstructions of 1876. They are contemporary photographs of a coastline that still
                carries the event: Redgate Beach and Calgardup Bay, where the hull lies a few metres down; Isaac Rock,
                known as Black Rock at the time of the wreck; and the neighbouring Contos shore. On a rare day of low
                swell, clear water and a stripped sandbank, the wreck shows as a dark line. Most days it does not.
              </p>
              <p>
                Each print is made to order on archival paper, signed and numbered by John Bowskill. Edition sizes are
                strictly limited. They can be bought online or during the exhibition.
              </p>
              {featuredPrints.length > 0 ? (
                <ul className={styles.printGrid}>
                  {featuredPrints.map((print) => (
                    <li key={print.slug}>
                      <Link href={`/shop/${print.slug}`} className={styles.printCard}>
                        <span className={styles.printImageWrap}>
                          <Image
                            src={print.image_url}
                            alt={print.alt_text?.trim() || print.title}
                            fill
                            unoptimized={
                              print.image_url.startsWith("/images/") || print.image_url.startsWith("/video/")
                            }
                            sizes="(max-width: 699px) 100vw, 220px"
                            className={styles.printImage}
                          />
                        </span>
                        <span className={styles.printTitle}>{print.title}</span>
                        {print.location_tag ? (
                          <span className={styles.printPlace}>{print.location_tag}</span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p>
                <Link href="/shop" className={styles.inlineLink}>
                  Browse the photographs →
                </Link>
              </p>
            </section>

            <section className={styles.proseBlock} aria-labelledby="home-installations-heading">
              <h2 id="home-installations-heading" className={styles.sectionHeading}>
                Three installations
              </h2>
              <p>
                Cubarama is a four-wall 360° video of the Georgette coast. Drift is a Kinect-driven work in which a
                visitor&apos;s movement chooses which photographs appear. Captain Godfrey is an interactive MetaHuman
                drawn from the 1876 inquiry record — the master whose certificate was suspended after the wreck, and
                who visitors can question.
              </p>
              <p>
                <Link href="/installations" className={styles.inlineLink}>
                  Explore the installations →
                </Link>
              </p>
            </section>

            <div className={styles.aboutBlock}>
              <p className={styles.aboutEyebrow}>Visit</p>
              <h2 className={styles.blockHeading}>12–27 September 2026 · Free admission</h2>
              <p className={styles.aboutCopy}>
                Daily 10am–5pm at 20 Morris Rd, Forest Grove WA 6286, during Margaret River Region Open Studios. Drive
                through the front gate and stop at the first house on the right. Two stone pillars mark the gallery.
              </p>
              <p className={styles.aboutCopy}>
                Forest Grove is in the Margaret River region of Western Australia, about three hours south of Perth.
                On-site parking is free.
              </p>
              <nav className={styles.aboutLinks} aria-label="Continue exploring">
                <Link href="/visit">Plan your visit →</Link>
                <Link href="/book">Author&apos;s preface →</Link>
                <Link href="/about-the-photographer">About the photographer →</Link>
              </nav>
            </div>

            <div className={styles.talkBlock}>
              <p className={styles.aboutEyebrow}>Public talk</p>
              <p className={styles.talkTitle}>Marcia van Zeller — The Truth About the Georgette</p>
              <p className={styles.aboutCopy}>
                Author and historian Marcia van Zeller — whose research into the Georgette formed the basis of her
                novel The Capes — gives a free public talk on Sunday 20 September, 11am–12pm. All welcome.
              </p>
              <Link href="/installations#talk" className={styles.inlineLink}>
                About the talk / reserve a place →
              </Link>
            </div>

            <section className={styles.faqBlock} aria-labelledby="home-faq-heading">
              <h2 id="home-faq-heading" className={styles.sectionHeading}>
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
        </div>
      </section>
    </>
  );
}
