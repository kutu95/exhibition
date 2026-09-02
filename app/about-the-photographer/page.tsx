import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FadeInSection } from "../../components/FadeInSection";
import { JsonLd } from "../../components/JsonLd";
import { awaitPageMetadata, buildPageMetadata } from "../../lib/seo-content";
import {
  buildAboutPage,
  buildBreadcrumb,
  buildPhotographerPerson,
} from "../../lib/structured-data";
import styles from "./page.module.css";

const PORTRAIT_SRC = "/images/john-bowskill-portrait.jpg";
const PREFACE_HREF = "/book";

export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("about");
}

export default async function AboutPhotographerPage() {
  await awaitPageMetadata("about");

  return (
    <>
      <JsonLd data={buildAboutPage()} />
      <JsonLd data={buildPhotographerPerson()} />
      <JsonLd
        data={buildBreadcrumb([
          { name: "Home", path: "/" },
          { name: "About the Photographer", path: "/about-the-photographer" },
        ])}
      />

      <article className={`section container-narrow ${styles.article}`}>
        <header className={`${styles.intro} ${styles.introWithPortrait}`}>
          <div className={styles.portraitWrap}>
            <Image
              src={PORTRAIT_SRC}
              alt="Portrait of photographer John Bowskill"
              fill
              className={styles.portrait}
              sizes="(max-width: 699px) 100vw, 280px"
              priority
            />
          </div>
          <div className={styles.introText}>
            <p className="eyebrow">The Georgette 150th</p>
            <h1 className="heading-section">About photographer John Bowskill</h1>
            <p className={styles.lead}>
              John Bowskill is a Margaret River photographer, and the photographer behind The Georgette 150th
              Photographic Exhibition.
            </p>
          </div>
        </header>

        <FadeInSection className={styles.prose}>
          <p>
            John spent years photographing the stretch of coastline around Redgate, near where he lives. He became
            fascinated with the story of the Georgette on an autumn day a few years ago, when flying his drone over the
            sea and, by coincidence, every condition was right: the swell was under a metre, the water was clear, the
            tide was low, the breeze was offshore, and the sand had washed away from the wreck, revealing it full
            length, in a way it&apos;s rarely seen. He couldn&apos;t leave it at that. He had to find out more of the
            shipwreck&apos;s story and this year he found himself on a plane to Scotland, to visit the Clyde, to the
            site of the Lower Woodyard number 1 shipyard where the Georgette was built — and, quite by coincidence, very
            close to the place of his own father&apos;s birth.
          </p>

          <blockquote className={styles.quote}>
            <p>Photography has sometimes taken me places I did not expect. It&apos;s not always just about the picture.</p>
          </blockquote>

          <p>
            John has now written a book about what he has learnt of the Georgette and her many stories. You can read a
            copy of the preface{" "}
            <Link className="text-link" href={PREFACE_HREF}>
              here
            </Link>
            .
          </p>

          <p>
            In finding new and unique ways to tell the stories and give context and meaning to the still images on
            display in the exhibition, John has leant on his tech skills to create some fascinating installations. None
            of them would have been possible without the use, in some way, of AI.
          </p>

          <p>
            AI is controversial in art. In this exhibition it has been used to create the artist&apos;s tools. Layer
            Painter is a tool he built to assist with painting digital compositions and murals. Cuborama Studio is a
            video editor he wrote specifically for four-wall projection cinema, because nothing existing was built for
            that format. The Drift installation runs on a custom app, built with AI assistance, that chooses what
            photograph to show based on how a visitor moves in front of it. And John Godfrey — the interactive version
            of the Georgette&apos;s captain who has been reincarnated as a metahuman that visitors can speak with —
            exists through a stack of tools that includes an AI clone of an actor&apos;s voice and an AI model standing
            in for the captain&apos;s mind and a gaming engine running on a high end graphics computer. Some of this sits
            in genuinely contested territory for an art exhibition. It pushes boundaries that he is happy to talk about.
          </p>

          <p>
            He shoots with a variety of still, underwater and drone cameras and edits in Lightroom. But this project is
            about this little ship, hiding in plain sight at a beautiful South West beach. A beach now enjoyed by many
            but whose stories are known by few.
          </p>

          <p>
            The little mail steamer and her record breaking run from London to Fremantle, her day as a battleship, her
            infamous groundings and final sinking, the Grace Bussell mythology, the underplayed role of Sam Isaacs,
            Annie Simpson the 20 year old mother who kept her 5 month old baby alive for a night in the sea, the
            underwater explorers who lost both her propellers, the academics who could not find them again, the bell that
            hung in a tree for 60 years, the telescope found, lost and found again and the timber still on the sea floor
            that began life in oak trees that lived before the arrival of Europeans on our shores.
          </p>

          <p>How could anyone not be fascinated by all that? John hopes you enjoy the exhibition.</p>
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <ul className={styles.linkList}>
            <li>
              <Link href="/">The Georgette 150th homepage →</Link>
            </li>
            <li>
              <Link href="/story">The story of the SS Georgette →</Link>
            </li>
            <li>
              <Link href="/installations">Installations →</Link>
            </li>
            <li>
              <Link href="/shop">Photographs →</Link>
            </li>
            <li>
              <Link href="/visit">Visit the exhibition →</Link>
            </li>
          </ul>
        </FadeInSection>
      </article>
    </>
  );
}
