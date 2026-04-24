import type { Metadata } from "next";
import Image from "next/image";

import { EmailSignupForm } from "../../components/EmailSignupForm";
import { FadeInSection } from "../../components/FadeInSection";
import { InstallationPageTracker } from "../../components/InstallationPageTracker";
import { JsonLd } from "../../components/JsonLd";
import { SectionDivider } from "../../components/SectionDivider";
import { buildMetadata, siteConfig } from "../../lib/metadata";
import { createSupabaseServerClient } from "../../lib/supabase/server";
import { getInstallationBody } from "../../lib/utils/installation-content";
import {
  isManagedLocalMediaPath,
  resolveContentImage,
  type SiteContentImageRow,
} from "../../lib/utils/site-content-image";
import { buildBreadcrumb } from "../../lib/structured-data";
import styles from "./page.module.css";

export const metadata: Metadata = buildMetadata({
  title: "Installations",
  description:
    "Three immersive installations — Cubarama, Captain Godfrey AI, and Drift — at The Georgette 150th exhibition, Margaret River Region Open Studios 2026.",
  path: "/installations",
  ogImage: siteConfig.ogImage.installations,
});

const installationContentKeys = [
  "installation_cubarama",
  "installation_captain_godfrey_ai",
  "installation_drift",
] as const;

const installationImageKeys = [
  "installation_cubarama_image",
  "installation_captain_godfrey_image",
  "installation_drift_image",
] as const;

const installationPageContentKeys = [...installationContentKeys, ...installationImageKeys] as const;

const installationImageFallbacks = {
  installation_cubarama_image: {
    src: "/images/placeholder-installation-cubarama.jpg",
    alt: "Cubarama installation concept",
  },
  installation_captain_godfrey_image: {
    src: "/images/placeholder-installation-godfrey.jpg",
    alt: "Captain Godfrey AI installation concept",
  },
  installation_drift_image: {
    src: "/images/placeholder-installation-drift.jpg",
    alt: "Drift Kinect installation concept",
  },
} as const;

export default async function InstallationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("site_content")
    .select("content_key, content_value, media_files(alt_text, url_path)")
    .in("content_key", [...installationPageContentKeys]);

  const rowByKey = new Map((data ?? []).map((row) => [row.content_key, row]));
  const textValue = (key: (typeof installationContentKeys)[number]) => {
    const row = rowByKey.get(key) as { content_value: string | null } | undefined;
    return row?.content_value ?? null;
  };

  const cubarama = getInstallationBody(textValue("installation_cubarama"), "cubarama");
  const captainGodfrey = getInstallationBody(
    textValue("installation_captain_godfrey_ai"),
    "captain_godfrey",
  );
  const drift = getInstallationBody(textValue("installation_drift"), "drift");

  const cubaramaImage = resolveContentImage(
    rowByKey.get("installation_cubarama_image") as SiteContentImageRow | undefined,
    installationImageFallbacks.installation_cubarama_image,
  );
  const captainGodfreyImage = resolveContentImage(
    rowByKey.get("installation_captain_godfrey_image") as SiteContentImageRow | undefined,
    installationImageFallbacks.installation_captain_godfrey_image,
  );
  const driftImage = resolveContentImage(
    rowByKey.get("installation_drift_image") as SiteContentImageRow | undefined,
    installationImageFallbacks.installation_drift_image,
  );

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
              src={cubaramaImage.src}
              alt={cubaramaImage.alt}
              fill
              className={styles.image}
              sizes="(max-width: 929px) 100vw, 50vw"
              unoptimized={isManagedLocalMediaPath(cubaramaImage.src)}
            />
          </div>
          <div className={styles.content}>
            <p className="eyebrow">360° Immersive Video</p>
            <h2>Cubarama</h2>
            {cubarama.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </FadeInSection>

        <SectionDivider />

        <FadeInSection className={`${styles.sectionBlock} ${styles.reverse}`} id="captain-godfrey">
          <div className={styles.imageWrap}>
            <Image
              src={captainGodfreyImage.src}
              alt={captainGodfreyImage.alt}
              fill
              className={styles.image}
              sizes="(max-width: 929px) 100vw, 50vw"
              unoptimized={isManagedLocalMediaPath(captainGodfreyImage.src)}
            />
          </div>
          <div className={styles.content}>
            <p className="eyebrow">Interactive AI · MetaHuman</p>
            <h2>Captain Godfrey</h2>
            {captainGodfrey.paragraphs.map((p, i) => (
              <p key={i} className={i === captainGodfrey.noteParagraphIndex ? styles.note : undefined}>
                {p}
              </p>
            ))}
          </div>
        </FadeInSection>

        <SectionDivider />

        <FadeInSection className={styles.sectionBlock} id="drift">
          <div className={styles.imageWrap}>
            <Image
              src={driftImage.src}
              alt={driftImage.alt}
              fill
              className={styles.image}
              sizes="(max-width: 929px) 100vw, 50vw"
              unoptimized={isManagedLocalMediaPath(driftImage.src)}
            />
          </div>
          <div className={styles.content}>
            <p className="eyebrow">Kinect · Interactive</p>
            <h2>Drift</h2>
            {drift.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
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
              verdict. She will give a public talk during the first week of the exhibition — drawing on her research, her
              novel, and what fifteen years of living with this story has taught her about the gap between history and
              truth.
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
