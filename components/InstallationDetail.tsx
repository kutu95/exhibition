import Image from "next/image";
import Link from "next/link";

import type { InstallationPageContent } from "../lib/installation-pages";
import { installationPageList } from "../lib/installation-pages";
import { isManagedLocalMediaPath } from "../lib/utils/site-content-image";
import { FadeInSection } from "./FadeInSection";
import styles from "./InstallationDetail.module.css";

const CONTACT_EMAIL = "john@streamtime.com.au";

type InstallationDetailProps = {
  content: InstallationPageContent;
  image: { src: string; alt: string };
  visitorParagraphs: string[];
  noteParagraphIndex: number | null;
};

export function InstallationDetail({
  content,
  image,
  visitorParagraphs,
  noteParagraphIndex,
}: InstallationDetailProps) {
  const others = installationPageList.filter((page) => page.slug !== content.slug);

  return (
    <article className={`section ${styles.page}`}>
      <div className="container">
        <p className={styles.breadcrumb}>
          <Link href="/installations">Installations</Link>
          <span aria-hidden> / </span>
          <span>{content.title}</span>
        </p>

        <header className={styles.hero}>
          <div className={styles.heroImageWrap}>
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className={styles.heroImage}
              sizes="(max-width: 899px) 100vw, 55vw"
              priority
              unoptimized={isManagedLocalMediaPath(image.src)}
            />
          </div>
          <div className={styles.heroCopy}>
            <p className="eyebrow">{content.eyebrow}</p>
            <h1 className="heading-section">{content.title}</h1>
            <p className={styles.summary}>{content.summary}</p>
            <p className={styles.pitchLine}>
              Available for galleries and museums to license, buy, or borrow.
            </p>
            <a className={`button-solid ${styles.contactBtn}`} href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Enquiry: ${content.title} installation`)}`}>
              Enquire about {content.title}
            </a>
          </div>
        </header>

        <FadeInSection className={styles.section}>
          <h2>At the exhibition</h2>
          {visitorParagraphs.map((paragraph, index) => (
            <p key={index} className={index === noteParagraphIndex ? styles.note : undefined}>
              {paragraph}
            </p>
          ))}
        </FadeInSection>

        <FadeInSection className={styles.section}>
          <h2>How it works</h2>
          {content.howItWorks.map((paragraph) => (
            <p key={paragraph.slice(0, 48)}>{paragraph}</p>
          ))}
        </FadeInSection>

        <FadeInSection className={styles.section}>
          <h2>Technology</h2>
          <ul className={styles.list}>
            {content.technology.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </FadeInSection>

        <FadeInSection className={styles.section}>
          <h2>For galleries and museums</h2>
          {content.forInstitutions.map((paragraph) => (
            <p key={paragraph.slice(0, 48)}>{paragraph}</p>
          ))}
          <ul className={styles.list}>
            {content.formats.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </FadeInSection>

        <FadeInSection className={styles.section}>
          <h2>What a venue needs</h2>
          <ul className={styles.list}>
            {content.requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </FadeInSection>

        <FadeInSection className={styles.enquire}>
          <h2>Discuss licensing, purchase, or loan</h2>
          <p>
            To talk about presenting {content.title} at your venue — or adapting the system for another collection —
            email{" "}
            <a className="text-link" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
          <a className="button-outline" href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(`Enquiry: ${content.title} installation`)}`}>
            Email an enquiry
          </a>
        </FadeInSection>

        <FadeInSection className={styles.related}>
          <h2>Other installations</h2>
          <ul className={styles.relatedList}>
            {others.map((page) => (
              <li key={page.slug}>
                <Link href={page.path}>{page.title} →</Link>
              </li>
            ))}
            <li>
              <Link href="/installations">All installations →</Link>
            </li>
          </ul>
        </FadeInSection>
      </div>
    </article>
  );
}
