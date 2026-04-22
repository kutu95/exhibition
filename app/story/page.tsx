import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FadeInSection } from "../../components/FadeInSection";
import { JsonLd } from "../../components/JsonLd";
import { ShareButtons } from "../../components/ShareButtons";
import { buildMetadata, siteConfig } from "../../lib/metadata";
import { buildBreadcrumb } from "../../lib/structured-data";
import styles from "./page.module.css";

export const metadata: Metadata = buildMetadata({
  title: "The Story",
  description:
    "On 1 December 1876, the SS Georgette foundered off the south-west coast of Western Australia. Seven people drowned. This is the story the history books got wrong.",
  path: "/story",
  ogImage: siteConfig.ogImage.story,
});

export default function StoryPage() {
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
          src="/images/placeholder-story-hero.jpg"
          alt="South West coastline near the SS Georgette wreck sites"
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
          <p>The Georgette left Fremantle on 29 November 1876 — an iron sail and steamship, three years in colonial service, carrying passengers and cargo south along the coast. By that evening, rounding Cape Naturaliste, the ship had begun to leak. The Chief Engineer reported extra water in the bilge. Captain John Godfrey was informed. He ordered the pumps checked and did not go below himself.</p>
          <p>By 4am on 1 December, the water was rising faster than the pumps could handle. The fires under the boilers were extinguished by flooding. Godfrey ordered all hands and ran the ship for shore. He had no other choice. Twenty miles offshore, with a flooding hull and failing engines, the beach was the only option that offered any chance of survival.</p>
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <h2>The lifeboat</h2>
          <p>In the darkness before dawn, with the ship going down fast, Godfrey ordered the lifeboat launched. Women and children were placed aboard — twelve of them, some with infants in arms. The boat was to be towed astern until the ship grounded and a safer landing could be arranged.</p>
          <p>It never reached the shore. As the lifeboat was towed behind the moving ship, it sheered in against the hull and capsized. Seven people drowned. In the chaos that followed — crew jumping overboard, the gig being cut loose, survivors clinging to the upturned hull — what had been a managed evacuation became a catastrophe.</p>
          <p>The inquiry later found Godfrey guilty on two charges: neglect of duty in not more thoroughly checking the ship's condition the previous evening, and grave error of judgement in placing passengers in the lifeboat under those conditions. His certificate of competency was suspended for eighteen months. A manslaughter charge followed. He maintained until the end that he had been made a scapegoat — that any competent master would have done the same.</p>
        </FadeInSection>

        <p className={styles.quote}>
          "Seven people drowned. The inquiry found him guilty. He never stopped believing he had done the right thing."
        </p>

        <FadeInSection className={styles.prose}>
          <h2>The beach</h2>
          <p>The Georgette grounded in Calgardup Bay in the early morning of 1 December 1876. Approximately fifty passengers and crew made it ashore through the surf — some by the ship's remaining boats, some by a rope hauled between the ship and the beach, some by swimming.</p>
          <p>Later that morning, Grace Bussell — a sixteen-year-old from the nearby Wallcliffe homestead — and Sam Isaacs, an Aboriginal stockman employed by the Bussell family, rode down through the dunes to the beach. What happened next has been told many ways.</p>
          <p>The press at the time credited Grace Bussell with riding repeatedly into the surf to pull survivors to safety — a story that spread through the colony and reached London. She was compared to Grace Darling, the English lighthouse keeper's daughter celebrated for her own sea rescue. Medals were struck. Paintings were made. The legend was set.</p>
          <p>But passenger George Leake — a young law student who had been on board and narrowly escaped drowning — wrote a private letter to a senior public servant in the Colonial Secretary's office, contradicting the published accounts. He wrote that Grace and Sam had not ridden into the heavy surf at all; that the horses could not have kept their footing in such conditions; that the passengers had been brought ashore by the ship's crew using a rope system before the riders arrived. He was at pains to say Grace Bussell had behaved admirably and would have gone further into the water had it been necessary. But his account of what she actually did was a far quieter thing than the legend required.</p>
        </FadeInSection>

        <p className={styles.quote}>
          'The vessel was seen going ashore by one of Mr Bussell's stockman and he and one of the Miss Bussells came
          down to us on the beach; it was a great relief to see them for then we knew help was near.' — George Leake,
          1877
        </p>

        <FadeInSection className={styles.prose}>
          <h2>The man who was forgotten</h2>
          <p>Sam Isaacs rode to that beach alongside Grace Bussell. He was there — that much is not in dispute. But where Grace Bussell received medals, public recognition, and a permanent place in Western Australian history, Sam Isaacs received almost nothing.</p>
          <p>Accounts varied. Some credited him with equal courage. Others reduced him to a secondary figure — present, helpful, but subordinate. Newspaper reports of the time sometimes mentioned him, sometimes did not. The Colonial Secretary's office, when seeking testimonials to support the bestowal of honours, was building a case shaped by the values of colonial Western Australia in 1877 — and those values did not easily accommodate the idea of an Aboriginal man as a hero in his own right.</p>
          <p>Marcia van Zeller, whose research into the Georgette formed the basis of her doctoral novel Cruel Capes at Curtin University, has argued that Sam Isaacs' contribution was systematically underplayed — not by any single act of erasure, but by the accumulated weight of a culture that found Grace Bussell's story more convenient, more romantic, and more publishable. Van Zeller will give a public talk during the first week of the exhibition. Details below.</p>
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <h2>One hundred and fifty years</h2>
          <p>The Georgette's wreck lies a few metres beneath the surface of Calgardup Bay. On a calm day you can see the shadow of it from the beach. Most days you cannot.</p>
          <p>John Bowskill has been photographing these locations — Calgardup Bay, Redgate Beach, Isaac Rock, the wreck site — as the basis for this exhibition. The photographs are not illustrations of the historical events. They are pictures of places that carry the weight of what happened in them: the light on the water, the shape of the rocks, the quality of the air at different hours. The history is in the landscape. The camera finds it at an angle that words cannot reach.</p>
          <p>The Georgette 150th opens at Margaret River Region Open Studios on 12 September 2026. One hundred and forty-nine years, nine months, and eleven days after the ship went down.</p>
        </FadeInSection>

        <ShareButtons
          url={`${siteConfig.url}/story`}
          title="The Wreck of the SS Georgette — The Georgette 150th"
          description="The story the history books got wrong."
        />

        <div className={styles.bottomLinks}>
          <Link href="/installations">Explore the installations →</Link>
          <Link href="/shop">View the photographs →</Link>
        </div>
      </article>
    </>
  );
}
