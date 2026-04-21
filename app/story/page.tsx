import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FadeInSection } from "../../components/FadeInSection";
import styles from "./page.module.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3007";

export const metadata: Metadata = {
  title: "The Story",
  description:
    "The long-form history of the SS Georgette wreck, the coastal rescue, and the contested legacy that shapes this exhibition.",
  alternates: {
    canonical: "/story",
  },
  openGraph: {
    type: "article",
    url: `${siteUrl}/story`,
    title: "The Story | SS Georgette Exhibition",
    description:
      "The long-form history of the SS Georgette wreck, the coastal rescue, and the contested legacy that shapes this exhibition.",
    images: [{ url: "/images/placeholder-story-hero.jpg" }],
  },
};

export default function StoryPage() {
  return (
    <>
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
          <p className="eyebrow">Margaret River · Western Australia</p>
          <h1 className={`heading-section ${styles.title}`}>The Wreck of the SS Georgette</h1>
          <p className={styles.subtitle}>12 January 1876</p>
        </header>

        <FadeInSection className={styles.prose}>
          <p>
            In the summer of 1876, the SS Georgette worked the coast as so many colonial steamers
            did: carrying passengers, mail, cargo, expectation. She moved between settlements that
            were still learning how to name themselves against wind and distance. Off the south-west
            coast, weather could turn a routine leg into something else entirely. By the time the ship
            neared Red Gate Beach, sea conditions and command decisions had begun to narrow the margin
            for error. The coast offered no shelter, only reef, current, and a long memory for iron.
          </p>
          <p>
            Survivors described the confusion in fragments: shouted orders, shifting ballast of fear,
            and the sensation that the vessel had ceased to belong to those aboard her. In maritime
            disasters there is often a single clean story, but Georgette resists that impulse. Even in
            the earliest reports, accounts disagreed on timing, discipline, and whether caution had
            already given way to pride. What remains consistent is the sound of surf and the stark
            fact that the ship did not recover.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <p>
            The worst losses came when a lifeboat capsized. Seven people drowned in water close enough
            to shore to be seen, but violent enough to take them anyway. That contradiction sits at the
            heart of the tragedy: proximity without rescue, witness without immediate power. The coast
            is full of such moments, where distance is measured in metres and impossibility in seconds.
          </p>
          <p>
            In the days that followed, legal language moved in quickly. Testimony sought sequence:
            who gave which order, who obeyed, who hesitated, who had already accepted that the ship
            was lost. Captain John Godfrey became the focal point for grief and blame. Manslaughter was
            spoken aloud; negligence was argued; seamanship itself was put on trial. To read the record
            now is to feel two pressures at once: the need to account for the dead, and the imperfect
            instruments available to make certainty out of catastrophe.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <p>
            Against that courtroom future stands the coastal rescue that entered legend almost
            immediately. Grace Bussell and Aboriginal stockman Sam Isaacs rode into the surf to pull
            survivors clear. The image was irresistible to newspapers: courage on horseback, white foam,
            righteous salvation. Yet the way the story was retold over decades often flattened it into a
            single figure of heroism, as if history were more comfortable with one name than two.
          </p>
          <p>
            Isaacs was there in the water, in the risk, in the work of keeping bodies afloat. Any honest
            account has to hold that plainly. The rescue is not diminished by being shared; it is made
            truer. This exhibition returns to that shared courage, and to the ways official memory can
            polish a myth while leaving out the person who made it possible.
          </p>
        </FadeInSection>

        <blockquote className={styles.quote}>
          “For generations, Sam Isaacs was placed at the edge of his own act of bravery — present in
          fact, absent in the telling.”
        </blockquote>

        <FadeInSection className={styles.prose}>
          <p>
            The marine inquiry at Busselton tried to pin the event to a manageable record. Godfrey gave
            evidence in a tone that alternated between authority and injury. He argued that conditions
            had overwhelmed command, that hindsight was being mistaken for foresight, that he had become
            a vessel for anger no one could direct at the sea itself. The tribunal was unconvinced.
            Charges proceeded, and his certificate was suspended for eighteen months.
          </p>
          <p>
            Whether that judgment was proportionate remains contested. Some saw a necessary consequence;
            others saw a scapegoat in uniform. What is clear is that the ruling did not settle the case
            in cultural memory. It merely moved the argument from dockside and courtroom into families,
            local lore, and later historical research, where contradiction survives better than verdict.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <p>
            Today the wreck lies near Calgardup Bay and Isaac Rock, dispersed and half-hidden by tide,
            kelp, and shifting sand. No grand ruin rises from the water. Instead there are coordinates,
            stories, occasional fragments, and a coastline that still feels charged with unfinished
            testimony. Red Gate Beach, Calgardup Bay, Isaac Rock, and the wreck site itself are less
            backdrop than archive: each place holding a separate piece of the same night.
          </p>
          <p>
            The photographs in this project approach those places as witnesses. Not to solve the case,
            but to stay with its weight: beauty beside loss, rescue beside erasure, spectacle beside
            silence. If there is a truth here, it may be composite — carried across people, transcripts,
            weather reports, and surf. To stand at these sites now is to feel that history is not past
            tense. It is still arriving, wave by wave.
          </p>
        </FadeInSection>

        <div className={styles.bottomLinks}>
          <Link href="/installations">Explore the installations →</Link>
          <Link href="/shop">View limited edition photographs →</Link>
        </div>
      </article>
    </>
  );
}
