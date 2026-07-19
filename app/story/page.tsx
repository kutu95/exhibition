import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FadeInSection } from "../../components/FadeInSection";
import { JsonLd } from "../../components/JsonLd";
import { ShareButtons } from "../../components/ShareButtons";
import { buildMetadata, siteConfig } from "../../lib/metadata";
import { buildBreadcrumb } from "../../lib/structured-data";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import styles from "./page.module.css";

export const metadata: Metadata = buildMetadata({
  title: "The Story",
  description:
    "On 1 December 1876, the SS Georgette foundered off the south-west coast of Western Australia. Seven people drowned. This is the story the history books got wrong.",
  path: "/story",
  ogImage: siteConfig.ogImage.story,
});

const storyContentKeys = ["story_hero_image"] as const;

const isManagedLocalMediaPath = (src: string) => src.startsWith("/images/") || src.startsWith("/video/");

export default async function StoryPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("site_content")
    .select("content_key, content_value")
    .in("content_key", [...storyContentKeys]);

  if (error) {
    throw new Error(`Failed to load story site content: ${error.message}`);
  }

  const storyHeroImageRow = (data ?? []).find((row) => row.content_key === "story_hero_image");
  const storyHeroImageSrc = storyHeroImageRow?.content_value?.trim();
  const storyHeroImageAlt = "";

  if (!storyHeroImageSrc) {
    const returnedKeys = (data ?? []).map((row) => row.content_key).join(", ") || "none";
    throw new Error(
      `Missing required site content image: story_hero_image. Returned site_content keys: ${returnedKeys}`,
    );
  }

  return (
    <>
      <JsonLd
        data={buildBreadcrumb([
          { name: "Home", path: "/" },
          { name: "The Story", path: "/story" },
        ])}
      />
      <section className={styles.hero}>
        <Image
          src={storyHeroImageSrc}
          alt={storyHeroImageAlt}
          unoptimized={isManagedLocalMediaPath(storyHeroImageSrc)}
          fill
          className={styles.heroImage}
          priority
          sizes="100vw"
        />
      </section>

      <article className="section container-narrow">
        <header className={styles.intro}>
          <p className="eyebrow">1 December 1876 · South-West Western Australia</p>
          <h1 className={`heading-section ${styles.title}`}>The Wreck of the SS Georgette</h1>
        </header>

        <FadeInSection className={styles.prose}>
          <h2>A ship in trouble</h2>
          <p>
            The Georgette left Fremantle on 29 November 1876 — an iron screw-steamer under sail and steam, three years
            into colonial service, carrying fifty passengers and a cargo of jarrah south along the coast, bound for
            Adelaide. By the evening of 30 November, rounding Cape Naturaliste, the ship had begun to leak. The Chief
            Engineer reported extra water in the bilge. Captain John Godfrey was informed. He ordered the pumps checked
            and did not go below himself.
          </p>
          <p>
            Shortly after midnight, midway between Cape Naturaliste and Cape Hamelin, the pumps failed outright. By 4am
            on 1 December, passengers and crew were bailing by bucket, and losing. Near dawn, the rising water reached
            the boilers and put out the fires. Godfrey turned the ship for shore. He had no other choice. With a flooding
            hull and dead engines, the beach was the only option that offered any chance of survival.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <h2>The lifeboat</h2>
          <p>
            In the darkness before dawn, with the ship going down fast, Godfrey ordered the lifeboat and gig launched.
            Men, women and children were placed aboard the lifeboat— 22 of them, some with infants in arms. The lifeboat
            was to be towed astern until the ship grounded and a safer landing could be arranged.
          </p>
          <p>
            The gig, a smaller boat with 14 aboard, came to shore at Injidup beach miles to the north but the lifeboat
            never reached the shore. As it was lowered into the sea, it stove in against the hull and capsized. Eight
            people drowned. In the chaos that followed — crew jumping overboard, the gig being cut loose, survivors
            clinging to the upturned hull — what had been a managed evacuation became a catastrophe.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <h2>The beach</h2>
          <p>
            The Georgette grounded in Calgardup Bay in the early morning of 1 December 1876. Approximately fifty
            passengers and crew made it ashore through the surf — some by the ship&apos;s remaining boats, some by a
            rope hauled between the ship and the beach, some by swimming.
          </p>
          <p>
            Later that morning, Grace Bussell — sixteen years old, from the nearby Wallcliffe homestead — and Sam Isaacs,
            an Aboriginal stockman employed by her family, rode down through the dunes to the beach. What happened next
            has been told many ways.
          </p>
          <p>
            The press at the time credited Grace Bussell with riding repeatedly into the surf to pull survivors to
            safety — a story that spread through the colony and reached London. She was compared to Grace Darling, the
            English lighthouse keeper&apos;s daughter celebrated for her own sea rescue. Medals were struck. Paintings
            were made. The legend was set.
          </p>
          <p>
            But passenger George Leake — a young law student who had been on board and narrowly escaped drowning — left
            his own, quieter account, contradicting parts of the published story. By his telling, the horses could not
            have kept their footing in surf that heavy; much of the landing had already been managed by the crew using a
            rope system before the riders arrived. He was at pains to say Grace Bussell had behaved admirably and would
            have gone further into the water had it been necessary. But his account of what she actually did was a far
            quieter thing than the legend required.
          </p>
        </FadeInSection>

        <p className={styles.quote}>
          &ldquo;The vessel was seen going ashore by one of Mr Bussell&apos;s stockmen, and he and one of the Miss
          Bussells came down to us on the beach; it was a great relief to see them, for then we knew help was
          near.&rdquo; — George Leake, 1877
        </p>

        <aside className={styles.talkCallout}>
          <p className={styles.talkEyebrow}>Public talk</p>
          <p className={styles.talkHook}>What really happened at Calgardup Bay?</p>
          <p className={styles.talkCopy}>
            Author and historian Marcia van Zeller — whose research into the Georgette formed the basis of her novel
            The Capes — gives a free public talk during the exhibition. Date and time to be confirmed.
          </p>
          <Link className={styles.talkLink} href="/installations#talk">
            About the talk →
          </Link>
        </aside>

        <FadeInSection className={styles.prose}>
          <h2>The man who was forgotten</h2>
          <p>
            Sam Isaacs saw the wreck first. He rode to the Bussell homestead to raise the alarm, and it was Grace who
            insisted on riding back to the beach with him — not the other way around. By one family account, passed down
            through Isaacs&apos; own descendants, it was Isaacs who went into the surf again and again, hauling
            survivors clear, while Grace — after her horse struggled to hold its footing and Isaacs warned she risked
            drowning the very people she was trying to save — returned to the beach and stayed there.
          </p>
          <p>
            For his part in the rescue, Isaacs was awarded the Royal Humane Society&apos;s bronze medal. Grace Bussell
            received the silver medal, a gold watch and chain paid for by public subscription, a place in the history
            books, and a town named after her. The land is often folded into Isaacs&apos; story as though it were part
            of the same reward — it wasn&apos;t. He bought his hundred acres at Wallcliffe himself, in 1897, twenty-one
            years after the rescue, at full price, becoming the first Aboriginal person in Western Australia to hold a
            freehold Crown grant. That was his own doing, not a gift. Isaacs received a smaller medal, no land, no
            watch, and, in most tellings since, a supporting role in someone else&apos;s story.
          </p>
          <p>
            Marcia van Zeller, whose research into the Georgette formed the basis of her doctoral novel The Capes, has
            argued that Sam Isaacs&apos; contribution was systematically underplayed — not by any single act of erasure,
            but by the accumulated weight of a culture that found Grace Bussell&apos;s story more convenient, more
            romantic, and more publishable. Van Zeller will give a{" "}
            <Link href="/installations#talk" className="text-link">
              public talk during the exhibition
            </Link>
            .
          </p>
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <h2>One hundred and fifty years</h2>
          <p>
            The Georgette&apos;s wreck lies a few metres beneath the surface of Calgardup Bay, just off Redgate Beach.
            On a calm day you can see the shadow of it from the shore. Most days you cannot.
          </p>
          <p>
            John Bowskill has spent the past eight years photographing these locations — Calgardup Bay, Redgate Beach,
            Isaac Rock, the wreck site — as the basis for this exhibition. The photographs you will see are pictures of
            places that carry the weight of what happened in them. The history is in the landscape.
          </p>
          <p>
            The Georgette 150th opens at Margaret River Region Open Studios on 12 September 2026 — one hundred and
            forty-nine years, nine months, and eleven days after the ship went down.
          </p>
        </FadeInSection>

        <ShareButtons
          url={`${siteConfig.url}/story`}
          title="The Wreck of the SS Georgette — The Georgette 150th"
          description="The story the history books got wrong."
        />

        <div className={styles.bottomLinks}>
          <Link href="/installations#talk">Author talk →</Link>
          <Link href="/installations">Explore the installations →</Link>
          <Link href="/shop">View the photographs →</Link>
        </div>
      </article>
    </>
  );
}
