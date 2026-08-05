import type { Metadata } from "next";
import { existsSync } from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";

import { EmailSignupForm } from "../../components/EmailSignupForm";
import { FadeInSection } from "../../components/FadeInSection";
import { JsonLd } from "../../components/JsonLd";
import { awaitPageMetadata, buildPageMetadata } from "../../lib/seo-content";
import { siteConfig } from "../../lib/metadata";
import { buildArticle, buildBreadcrumb } from "../../lib/structured-data";
import styles from "./page.module.css";

/** Place the February 2024 drone wreck photograph at this path. */
const WRECK_IMAGE_SRC = "/images/georgette-wreck-drone-feb-2024.jpg";
const WRECK_IMAGE_ALT =
  "Drone photograph of the wreck of the SS Georgette, Calgardup Bay, February 2024";
const WRECK_IMAGE_CAPTION =
  "Drone photograph of the wreck of the SS Georgette, Calgardup Bay, February 2024. The rare alignment of low tide, clear water, an exposed sandbank and an offshore breeze that first revealed the wreck to the author.";

const FATHER_IMAGE_SRC = "/images/bill-bowskill-elderslie-1929.jpg";
const FATHER_IMAGE_ALT = "Bill Bowskill, aged six, sitting outside his house in Elderslie, Glasgow, 1929";
const FATHER_IMAGE_CAPTION = "Elderslie, Glasgow, 1929. Bill Bowskill, 6 years old.";

const PROP_IMAGE_SRC = "/images/broken-propeller-mark.png";
const PROP_IMAGE_ALT =
  "Artist’s impression of the corroded broken propeller of the SS Georgette, based on surviving photographs";
const PROP_IMAGE_CAPTION =
  "Artist’s impression of the corroded propeller based on surviving photographs.";

const hasWreckImage = existsSync(path.join(process.cwd(), "public", WRECK_IMAGE_SRC.replace(/^\//, "")));
const hasFatherImage = existsSync(path.join(process.cwd(), "public", FATHER_IMAGE_SRC.replace(/^\//, "")));
const hasPropImage = existsSync(path.join(process.cwd(), "public", PROP_IMAGE_SRC.replace(/^\//, "")));

export async function generateMetadata(): Promise<Metadata> {
  return buildPageMetadata("book");
}

export default async function BookSamplerPage() {
  await awaitPageMetadata("book");

  return (
    <>
      <JsonLd
        data={buildArticle({
          headline: "Author’s Preface — The Georgette",
          description:
            "John Bowskill on the drone flight that revealed the wreck at Calgardup Bay, the 1872 Dumbarton shipyard that built the SS Georgette, and the research that followed the ship back to the Clyde.",
          path: "/book",
          image: siteConfig.ogImage.story,
          section: "Maritime history",
        })}
      />
      <JsonLd
        data={buildBreadcrumb([
          { name: "Home", path: "/" },
          { name: "Author’s Preface", path: "/book" },
        ])}
      />

      <article className={`section container-narrow ${styles.article}`}>
        <header className={styles.intro}>
          <div className={styles.titleRow}>
            {hasPropImage ? (
              <Image
                src={PROP_IMAGE_SRC}
                alt=""
                width={72}
                height={72}
                className={styles.titleMark}
                priority
              />
            ) : null}
            <h1 className={`heading-section ${styles.title}`}>Author&apos;s Preface</h1>
          </div>
          <p className={styles.excerptLabel}>Excerpt from the book</p>
          <p className={styles.orderLink}>
            <a href="#register-interest">Order information</a>
          </p>
          <p className={styles.byline}>John Bowskill</p>
        </header>

        <FadeInSection className={styles.prose}>
          <p>This book began as research into a shipwreck and became, unexpectedly, something else as well.</p>

          <p>
            I had been photographing the coast around Calgardup Bay since 2017, mostly because that is the closest beach
            to my new home in Forest Grove. At that stage I knew the story of the Georgette the way most people who walk
            that section of the Cape to Cape Track know it: from the interpretive plaque above the car park at Redgate,
            in the version with Grace on the horse and the rest of it compressed into a paragraph. In February 2024 I
            flew a drone over the site on a morning when everything happened to align — the tide was low, the water was
            clear, there was no sand suspended in the swell, the sea itself was under a metre, the sand banks had moved
            away and exposed the wreck and the wind was blowing offshore. It is a combination that, by my own rough
            count since, occurs only a handful of times a year. On the screen of the controller, the wreck simply
            appeared — the dark, unmistakable line of a hull, lying exactly where the plaque said it would be. I had
            walked and photographed that beach for seven years only imagining the wreck was there somewhere. That
            morning it was there for all to see.
          </p>

          <figure className={styles.figure}>
            {hasWreckImage ? (
              <div className={styles.figureImageWrap}>
                <Image
                  src={WRECK_IMAGE_SRC}
                  alt={WRECK_IMAGE_ALT}
                  fill
                  className={styles.figureImage}
                  sizes="(max-width: 767px) 100vw, 42rem"
                  priority
                />
              </div>
            ) : (
              <div className={styles.figurePlaceholder} role="img" aria-label={WRECK_IMAGE_ALT}>
                <p>Photograph to be added</p>
              </div>
            )}
            <figcaption className={styles.figcaption}>{WRECK_IMAGE_CAPTION}</figcaption>
          </figure>

          <p>
            I had read Marcia van Zeller&apos;s book the year before, but it was not until late 2025 that I began the
            research in earnest — the Lloyd&apos;s Register entries, the newspaper accounts, the inquiry transcript —
            and then this year decided I had to trace the ship&apos;s roots all the way back to Scotland.
          </p>

          <p>
            The SS Georgette was built in 1872 at Dumbarton, on the south bank of the Clyde, at a new yard called
            McKellar, McMillan &amp; Co. She was the first vessel ever to leave their slipway — Yard Number 1 — and she
            was launched on the third of October that year into a river that was, at that moment, probably the most
            productive stretch of shipbuilding water in the world. Within a year she had left Scotland for Australia,
            where she would spend the remaining four years of her working life before going to the bottom off Calgardup
            Bay on the first of December 1876.
          </p>

          <p>I went to Scotland to find her origins. What I had not expected was to find my father&apos;s as well.</p>

          <p>
            He was born in Elderslie, a village just outside Paisley and about twelve miles upriver from Dumbarton. His
            name was Bill Bowskill. Elderslie is best known as the birthplace of William Wallace — every road sign says
            so, and the locals will stop you on the street to make sure you&apos;ve visited the memorial. But it is also
            the village where my father grew up, in the 1920s and 1930s, in the long shadow of the Depression. He rarely
            spoke about it. He never went back, at least not while I was a child, and he said little about Scotland or
            what it had been like to be young there. It was not a subject he returned to.
          </p>

          <p>
            He worked in a shipyard on the Clyde in the 1940s, by which time the industry that had built the Georgette
            was already far into its long decline. The same river, a generation later, a different kind of work. In
            1950, at twenty-seven, he did what tens of thousands of Scots did in those years: he emigrated to Australia.
          </p>

          <p>
            Standing in Elderslie, outside the house where he was born, I found myself thinking about the particular
            silence of people who leave a place and do not discuss it afterwards. I have a photograph of my father at
            six years old, sitting on the front steps of that house. There is no garden. The background is plain, the
            street quiet. The depression had its particular look, and it looked like that. Today the same house has a
            garden, the neighbourhood has colour and some bustle to it, the streets feel lived-in and reasonably
            prosperous. The place my father left is not the place I visited. He departed from the leaner version, and it
            has grown into something better.
          </p>

          <figure className={`${styles.figure} ${styles.figurePortrait}`}>
            {hasFatherImage ? (
              <div className={styles.figureImageWrap}>
                <Image
                  src={FATHER_IMAGE_SRC}
                  alt={FATHER_IMAGE_ALT}
                  fill
                  className={styles.figureImage}
                  sizes="(max-width: 767px) 100vw, 22rem"
                />
              </div>
            ) : (
              <div className={styles.figurePlaceholder} role="img" aria-label={FATHER_IMAGE_ALT}>
                <p>Photograph to be added</p>
              </div>
            )}
            <figcaption className={styles.figcaption}>{FATHER_IMAGE_CAPTION}</figcaption>
          </figure>

          <p>
            My father&apos;s reticence about Scotland always felt like a closed door. It did not feel like grief,
            exactly, or shame — more like a decision to face forward, to become Australian in the thorough way that his
            generation did, without looking back. But standing there, I understood something about the texture of what
            he had left.
          </p>

          <p>
            The Georgette left the same river seventy-eight years before him. She was, like him, bound for the
            south-west of Australia. She was, like him, not going back. The industry that built her and the industry
            that employed him as a young man were the same industry in its rise and in its fall, separated by the arc of
            a century.
          </p>

          <p>
            I do not want to over-read the coincidence. Ships are not people, and a research trip to a shipbuilding town
            is not the same as the journey my father made. But the overlap was impossible to ignore when I stood at the
            river and tried to imagine the Lower Woodyard as it was in 1872 — the noise and heat of it, the smell of hot
            metal and the Clyde at low tide — and then thought of my father, twenty years old, learning his trade on
            that same river.
          </p>

          <p>
            This book is about the Georgette. But it is also, in its own quieter way, about the river that made her, and
            the people the river sent away.
          </p>

          <p>
            The Lower Woodyard where the Georgette was built employed around five hundred men at its height. By 1879 —
            six years after she left — the yard was closed and empty. The river had been sending people away long before
            my father decided to go.
          </p>

          <p>
            What the research also found, and what this book became in part, was a question the shipwreck raised and the
            century and a half since has never fully answered: who gets remembered when a legend is built, and who is
            left out? That question hangs above all that follows. My sense is that there is a growing community interest
            in the truth.
          </p>

          <p>
            This leads me to explain the choice of image on the cover of the book. Why a broken propeller? When souvenir
            hunting divers attempted to salvage the propellers of the wreck in 1964, they had more of a fight on their
            hands than might have been expected. One prop was broken — a blade snapped off in the fight. It refused to
            leave the ship to which it belonged. That last time it was seen it had been reclaimed by the tides back into
            the deep. Attempts to dig it up in the 90s failed and the elusive prop is still there under the sand at
            Redgate beach. Exactly where it is and what became of the other propeller are now part of the mystery and
            the legend of the SS Georgette.
          </p>

          <figure className={`${styles.figure} ${styles.figureProp}`}>
            {hasPropImage ? (
              <div className={styles.figureImageWrap}>
                <Image
                  src={PROP_IMAGE_SRC}
                  alt={PROP_IMAGE_ALT}
                  fill
                  className={styles.figureImageContain}
                  sizes="(max-width: 767px) 100vw, 28rem"
                />
              </div>
            ) : (
              <div className={styles.figurePlaceholder} role="img" aria-label={PROP_IMAGE_ALT}>
                <p>Photograph to be added</p>
              </div>
            )}
            <figcaption className={styles.figcaption}>{PROP_IMAGE_CAPTION}</figcaption>
          </figure>
        </FadeInSection>

        <aside className={styles.interest} id="register-interest">
          <p className={styles.interestEyebrow}>The book</p>
          <h2 className={styles.interestTitle}>Register your interest</h2>
          <p className={styles.interestCopy}>
            The full book is in preparation. Leave your email and we&apos;ll let you know when it becomes available to
            buy — no spam, just the publication notice.
          </p>
          <EmailSignupForm
            source="book_interest"
            buttonLabel="Register interest"
            successMessage="Thanks — we'll be in touch when the book is available."
          />
        </aside>

        <nav className={styles.footerNav} aria-label="Related pages">
          <Link href="/about-the-photographer">About the photographer →</Link>
          <Link href="/story">The story of the Georgette →</Link>
          <Link href="/">The Georgette 150th homepage →</Link>
        </nav>
      </article>
    </>
  );
}
