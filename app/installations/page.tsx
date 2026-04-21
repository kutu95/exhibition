import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FadeInSection } from "../../components/FadeInSection";
import { SectionDivider } from "../../components/SectionDivider";
import styles from "./page.module.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3007";

export const metadata: Metadata = {
  title: "Installations",
  description:
    "Three immersive installation experiences: Cubarama, Captain Godfrey AI, and Drift.",
  alternates: {
    canonical: "/installations",
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/installations`,
    title: "Installations | SS Georgette Exhibition",
    description:
      "Three immersive installation experiences: Cubarama, Captain Godfrey AI, and Drift.",
    images: [{ url: "/images/placeholder-installations-hero.jpg" }],
  },
};

export default function InstallationsPage() {
  return (
    <div className="section">
      <div className="container">
        <FadeInSection className={styles.sectionBlock} id="cubarama">
          <div className={styles.imageWrap}>
            <Image
              src="/images/placeholder-installation-cubarama.jpg"
              alt="Cubarama installation concept"
              fill
              className={styles.image}
              sizes="(max-width: 929px) 100vw, 50vw"
            />
          </div>
          <div className={styles.content}>
            <p className="eyebrow">360° Immersive Video</p>
            <h2>Cubarama</h2>
            <p>
              Cubarama places you at the centre of a four-wall projection chamber where coastline,
              cloud, and water move as one continuous horizon. Sound rolls through the room like
              incoming weather; the floor feels steady while the visual field refuses to be still.
              Orientation becomes uncertain, not because you are lost, but because you are entirely
              inside the image.
            </p>
            <p>
              The work recreates the emotional physics of the wreck sites: beauty held inside threat,
              stillness interrupted by surge. To stand within it is to feel the coast wrapping around
              your peripheral vision, asking you to witness the event as environment rather than archive.
            </p>
          </div>
        </FadeInSection>

        <SectionDivider />

        <FadeInSection className={`${styles.sectionBlock} ${styles.reverse}`} id="captain-godfrey">
          <div className={styles.imageWrap}>
            <Image
              src="/images/placeholder-installation-godfrey.jpg"
              alt="Captain Godfrey AI installation concept"
              fill
              className={styles.image}
              sizes="(max-width: 929px) 100vw, 50vw"
            />
          </div>
          <div className={styles.content}>
            <p className="eyebrow">Interactive AI · MetaHuman</p>
            <h2>Captain Godfrey</h2>
            <p>
              In this installation, Captain John Godfrey appears in Victorian dress and answers your
              questions directly. He is formal, proud, and often defensive; he holds to the belief that
              command under pressure cannot be judged by calm hindsight. Conversations unfold in real
              time, and each response carries a trace of suppressed grief beneath his guarded poise.
            </p>
            <p>
              The character draws from the Busselton inquiry transcript, contemporary reporting, and
              competing witness accounts around the manslaughter charge and suspended certificate. Rather
              than presenting a verdict, the piece stages the argument itself: responsibility, reputation,
              and the possibility that history needed a scapegoat as much as it needed an explanation.
            </p>
            <p className={styles.note}>
              Voice and likeness provided by a human performer. Character informed by the marine inquiry
              transcript, Marcia van Zeller&apos;s research, and a firsthand passenger account by George
              Leake.
            </p>
          </div>
        </FadeInSection>

        <SectionDivider />

        <FadeInSection className={styles.sectionBlock} id="drift">
          <div className={styles.imageWrap}>
            <Image
              src="/images/placeholder-installation-drift.jpg"
              alt="Drift Kinect installation concept"
              fill
              className={styles.image}
              sizes="(max-width: 929px) 100vw, 50vw"
            />
          </div>
          <div className={styles.content}>
            <p className="eyebrow">Kinect · Interactive</p>
            <h2>Drift</h2>
            <p>
              Drift translates gesture into navigation. Raise an arm and an image clears; step sideways
              and the frame drifts along the shoreline. The body becomes a cursor, but slower and more
              deliberate, returning physical weight to acts of looking that usually happen with a thumb.
            </p>
            <p>
              The installation is designed around the idea that these photographs are not only to be
              seen, but encountered. As viewers move, the sequence responds in kind, producing a layered
              choreography of memory and motion where each passage through the work is slightly different.
            </p>
          </div>
        </FadeInSection>

        <div className="section">
          <FadeInSection className={styles.closing}>
            <p className="eyebrow">Public Program</p>
            <h2 className="heading-section">Marcia van Zeller public talk — date TBC</h2>
            <p>
              Details for &quot;The Truth About the Georgette&quot; will be announced soon, with venue and
              session time listed on the visit page.
            </p>
            <Link href="/visit">See visit details →</Link>
          </FadeInSection>
        </div>
      </div>
    </div>
  );
}
