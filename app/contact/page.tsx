import type { Metadata } from "next";

import { FadeInSection } from "../../components/FadeInSection";
import { JsonLd } from "../../components/JsonLd";
import { siteContact } from "../../lib/contact";
import { buildMetadata, siteConfig } from "../../lib/metadata";
import { buildBreadcrumb } from "../../lib/structured-data";
import styles from "./page.module.css";

export const metadata: Metadata = buildMetadata({
  title: "Contact",
  description:
    "Contact John Bowskill about The Georgette 150th exhibition, limited edition prints, installations, and private collections.",
  path: "/contact",
});

export default function ContactPage() {
  return (
    <section className="section container">
      <JsonLd
        data={buildBreadcrumb([
          { name: "Home", path: "/" },
          { name: "Contact", path: "/contact" },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Contact",
          url: `${siteConfig.url}/contact`,
          description: "Contact John Bowskill about the exhibition and limited edition prints.",
          mainEntity: {
            "@type": "Person",
            name: siteContact.name,
            email: siteContact.email,
            telephone: siteContact.phoneTel,
            url: "https://exhibition.margies.app/about-the-photographer",
          },
        }}
      />

      <div className={styles.grid}>
        <FadeInSection>
          <p className="eyebrow">Get in touch</p>
          <h1 className="heading-section">Contact</h1>
          <p className={styles.lead}>
            Questions about the exhibition, limited edition prints, installations, or private collections — John is
            happy to hear from you.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.card}>
          <h2>{siteContact.name}</h2>
          <ul className={styles.details}>
            <li>
              <span className={styles.detailLabel}>Email</span>
              <p className={styles.detailValue}>
                <a href={`mailto:${siteContact.email}`}>{siteContact.email}</a>
              </p>
            </li>
            <li>
              <span className={styles.detailLabel}>Phone</span>
              <p className={styles.detailValue}>
                <a href={`tel:${siteContact.phoneTel}`}>{siteContact.phoneDisplay}</a>
              </p>
            </li>
            <li>
              <span className={styles.detailLabel}>Exhibition venue</span>
              <p className={styles.detailValue}>{siteContact.location}</p>
            </li>
          </ul>
        </FadeInSection>

        <FadeInSection>
          <p className={styles.note}>
            The exhibition is open daily 10am–5pm, 12–27 September 2026. For print orders placed online, please include
            your order number in any email so we can help quickly.
          </p>
        </FadeInSection>
      </div>
    </section>
  );
}
