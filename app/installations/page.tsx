import type { Metadata } from "next";
import Image from "next/image";

import { EmailSignupForm } from "../../components/EmailSignupForm";
import { FadeInSection } from "../../components/FadeInSection";
import { InstallationPageTracker } from "../../components/InstallationPageTracker";
import { JsonLd } from "../../components/JsonLd";
import { SectionDivider } from "../../components/SectionDivider";
import { buildMetadata, siteConfig } from "../../lib/metadata";
import { buildBreadcrumb } from "../../lib/structured-data";
import styles from "./page.module.css";

export const metadata: Metadata = buildMetadata({
  title: "Installations",
  description:
    "Three immersive installations — Cubarama, Captain Godfrey AI, and Drift — at The Georgette 150th exhibition, Margaret River Region Open Studios 2026.",
  path: "/installations",
  ogImage: siteConfig.ogImage.installations,
});

export default function InstallationsPage() {
  return (
    <div className="section">
      <InstallationPageTracker />
      <JsonLd
        data={buildBreadcrumb([
          { name: "Home", path: "/" },
          { name: "Installations", path: "/installations" },
        ])}
      />
      <div className="container">
        <FadeInSection className={styles.pageIntro}>
          <p className="eyebrow">At the Exhibition</p>
          <h1 className="heading-section">Three immersive installations</h1>
          <p>
            The Georgette 150th is not only wall-hung photographs. Three installations use different technologies to
            place visitors inside the story — the place, the character, the act of looking.
          </p>
        </FadeInSection>

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
              You enter a room and the room becomes the coast. Four walls of projected video — the water, the rock,
              the sky at Calgardup Bay, Redgate Beach, Isaac Rock — surround you completely. There is no frame.
              There is no edge. The horizon is everywhere.
            </p>
            <p>
              Cubarama is a four-wall 360° video installation. The footage was shot on location at the exhibition
              sites. Standing at the centre of the room, you are standing at the centre of the place where the
              Georgette went down. The sound is the sound of the coast — wind, water, the particular silence of remote
              beaches in the early morning. You can stay as long as you like.
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
              Captain John Godfrey will speak with you. He is standing in the weeks following the Busselton marine
              inquiry of December 1876. His certificate of competency has been suspended for eighteen months. A
              manslaughter charge is before the courts. Fremantle, where he lives, is a port town with a long memory.
            </p>
            <p>
              Ask him about the night the Georgette went down. Ask him about the lifeboat. Ask him about William
              Dundee, his first officer, on whose incompetence he places significant blame. Ask him about Grace
              Bussell and Sam Isaacs. He will answer every question — in his own way, in his own register, with the
              pride and guardedness of a man who believes absolutely that he has been made a scapegoat.
            </p>
            <p>
              Captain Godfrey AI is a real-time interactive digital human — a MetaHuman figure animated live by
              artificial intelligence. His voice was recorded and cloned from a human performer. His character is
              built from the marine inquiry transcript, from Marcia van Zeller&apos;s historical research in Cruel
              Capes, and from the firsthand passenger account of George Leake. He is not playing back recordings.
              Every conversation is different.
            </p>
            <p className={styles.note}>
              Voice and likeness provided by a human performer. Character informed by the Busselton marine inquiry
              transcript (December 1876), Cruel Capes by Marcia van Zeller (Curtin University, 2014), and the letters
              of George Leake (State Records Office of Western Australia).
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
              The photographs are on the screen. You move, and they move with you. Drift is a Kinect-driven interactive
              display — your body becomes the interface. Step left and the images follow. Step closer and they open up.
              Stand still and they settle.
            </p>
            <p>
              The experience is not about navigation. It is about the relationship between a body and an image — the
              way looking at a photograph is never entirely passive. In Drift, that relationship becomes physical. The
              photographs are John Bowskill&apos;s images of the Georgette sites. The movement is yours.
            </p>
          </div>
        </FadeInSection>
      </div>

      <section className={styles.talkSection}>
        <div className="container">
          <FadeInSection className={styles.talkInner}>
            <p className="eyebrow">Public Talk</p>
            <h2 className="heading-section">Marcia van Zeller</h2>
            <p className={styles.talkSubheading}>The Truth About the Georgette</p>
            <p>
              Marcia van Zeller spent years researching the wreck of the SS Georgette for her doctoral novel Cruel
              Capes, completed at Curtin University in 2014. Her research took her to the State Records Office of
              Western Australia, the Battye Library, the tiny Busselton courtroom where the marine inquiry was held in
              December 1876, and to the coast itself — Redgate Beach, Calgardup Bay, the locations of this exhibition.
            </p>
            <p>
              Her work excavated the contradictions in the historical record: the eyewitness accounts that contradicted
              the press; the contested role of Sam Isaacs; the captain who was found guilty and never accepted the
              verdict. She will give a public talk during the first week of the exhibition — drawing on her research,
              her novel, and what fifteen years of living with this story has taught her about the gap between history
              and truth.
            </p>
            <p className={styles.dateLine}>Date and time to be confirmed · Free entry · Venue as exhibition</p>
            <p className={styles.signupLabel}>Notify me when the talk date is confirmed</p>
            <div className={styles.signupWrap}>
              <EmailSignupForm
                source="installations_talk"
                buttonLabel="Notify me when the talk date is confirmed"
              />
            </div>
          </FadeInSection>
        </div>
      </section>
    </div>
  );
}
