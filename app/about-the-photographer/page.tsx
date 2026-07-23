import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FadeInSection } from "../../components/FadeInSection";
import { JsonLd } from "../../components/JsonLd";
import { buildMetadata, siteConfig } from "../../lib/metadata";
import {
  buildAboutPage,
  buildBreadcrumb,
  buildPhotographerPerson,
} from "../../lib/structured-data";
import styles from "./page.module.css";

const PORTRAIT_SRC = "/images/john-bowskill-portrait.jpg";

export const metadata: Metadata = buildMetadata({
  absoluteTitle: "About Photographer John Bowskill | SS Georgette Exhibition",
  description:
    "Meet photographer John Bowskill, whose Georgette 150th exhibition commemorates the SS Georgette shipwreck at Redgate Beach near Margaret River, Western Australia.",
  path: "/about-the-photographer",
  ogImage: siteConfig.ogImage.about,
  ogType: "profile",
});

export default function AboutPhotographerPage() {
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
            <h1 className="heading-section">About the Photographer</h1>
            <p className={styles.lead}>
              John Bowskill is the photographer behind The Georgette 150th — a photographic exhibition commemorating the
              150th anniversary of the wreck of the SS Georgette at Redgate Beach near Margaret River, Western Australia.
            </p>
          </div>
        </header>

        <FadeInSection className={styles.prose}>
          <h2>The Georgette project</h2>
          <p>
            For the past eight years, John Bowskill has been photographing the coastal places tied to the Georgette
            story: Calgardup Bay, Redgate Beach, Isaac Rock, and the wreck site itself. The photographs shown in The
            Georgette 150th are pictures of places that carry the weight of what happened in them. The history is in the
            landscape.
          </p>
          <p>
            The exhibition opens during Margaret River Region Open Studios 2026 (12–27 September) at 20 Morris Rd,
            Forest Grove, and includes wall-hung prints alongside immersive installations built around the same sites
            and research.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <h2>Connection to the Margaret River region</h2>
          <p>
            The work is rooted in the Margaret River region of Western Australia — the same coastline where the SS
            Georgette foundered in December 1876. The exhibition invites visitors to Open Studios to encounter that
            local maritime history through contemporary photography.
          </p>
          {/* TODO(John): Add a short note on your personal connection to the Margaret River region, if you wish. */}
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <h2>Coastal landscapes and local stories</h2>
          <p>
            The Georgette 150th brings together coastal landscape photography with a specific historical narrative: the
            wreck, the contested rescue accounts, and the places that remain. Prints from the series are produced as
            limited editions on archival paper, signed and numbered by John Bowskill.
          </p>
          {/* TODO(John): Optionally expand on your wider interest in coastal landscapes, maritime history, or local stories beyond this project. */}
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <h2>Photographic approach</h2>
          <p>
            Beside the gallery prints, the exhibition includes installations such as Cubarama, Captain Godfrey AI, and
            Drift — ways of extending looking into immersive and interactive forms while remaining grounded in
            photographs of the Georgette sites.
          </p>
          {/* TODO(John): Add a sentence or two on how you approach making the photographs (process, timing, materials) if you want that public. */}
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <h2>Margaret River Open Studios 2026</h2>
          <p>
            The Georgette 150th is presented as part of Margaret River Region Open Studios 2026. Visitors can see the
            work in person daily from 10am to 5pm across the sixteen-day programme, with free admission.
          </p>
          <p>
            <Link href="/visit" className="text-link">
              Plan your visit →
            </Link>
          </p>
        </FadeInSection>

        <FadeInSection className={styles.prose}>
          <h2>Explore the exhibition</h2>
          <ul className={styles.linkList}>
            <li>
              <Link href="/">The Georgette 150th homepage →</Link>
            </li>
            <li>
              <Link href="/story">The story of the SS Georgette →</Link>
            </li>
            <li>
              <Link href="/shop">Limited edition photographs →</Link>
            </li>
            <li>
              <Link href="/installations">Installations →</Link>
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
