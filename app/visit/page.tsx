import type { Metadata } from "next";

import { EmailSignupForm } from "../../components/EmailSignupForm";
import { FadeInSection } from "../../components/FadeInSection";
import { JsonLd } from "../../components/JsonLd";
import { buildMetadata, siteConfig } from "../../lib/metadata";
import { buildBreadcrumb, buildExhibitionEvent } from "../../lib/structured-data";
import styles from "./page.module.css";

export const metadata: Metadata = buildMetadata({
  title: "Visit",
  description:
    "The Georgette 150th — open daily 10am–5pm, 12–27 September 2026. Margaret River Region Open Studios, Western Australia. Free admission.",
  path: "/visit",
  ogImage: siteConfig.ogImage.visit,
});

export default function VisitPage() {
  return (
    <section className="section container">
      <JsonLd data={buildExhibitionEvent()} />
      <JsonLd
        data={buildBreadcrumb([
          { name: "Home", path: "/" },
          { name: "Visit", path: "/visit" },
        ])}
      />
      <div className={styles.grid}>
        <FadeInSection className={styles.block}>
          <h1 className="heading-section">Plan your visit</h1>
        </FadeInSection>

        <FadeInSection className={styles.block}>
          <h2>12–27 September 2026</h2>
          <p>
            The Georgette 150th is part of Margaret River Region Open Studios 2026 — a region-wide open studios event
            across the Margaret River, Augusta, and Busselton areas each September.
          </p>
          <p>
            The exhibition is open daily from 10am to 5pm across the full sixteen-day run. Last entry to the Cubarama
            and Captain Godfrey AI installations is 4:30pm. Drift and wall-hung prints are accessible throughout
            opening hours.
          </p>
          <p>Admission is free.</p>
        </FadeInSection>

        <FadeInSection className={styles.block}>
          <h2>Getting here</h2>
          <p>
            The exhibition is located in the Margaret River region of Western Australia, approximately three hours south
            of Perth by car. Venue address and detailed directions will be confirmed and published here closer to the
            opening date.
          </p>
          <p>
            Margaret River township is the nearest service centre — fuel, food, and accommodation are readily
            available. The exhibition venue has free on-site parking.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.block}>
          <h2>What to expect</h2>
          <p>The exhibition includes three immersive installations and a gallery of wall-hung photographic prints.</p>
          <p>
            Cubarama — the 360° video room — runs as a continuous loop. No booking required. Visitors may enter and
            exit freely, though numbers inside the room are limited at any one time.
          </p>
          <p>
            Captain Godfrey AI — the interactive MetaHuman installation — is a one-to-one experience. Each
            conversation takes between five and fifteen minutes depending on the visitor. A small waiting area is
            provided outside the installation space.
          </p>
          <p>
            Drift — the Kinect-driven interactive display — is open access throughout the day. No booking required.
          </p>
          <p>
            Wall-hung prints from the Calgardup Bay, Redgate Beach, and Isaac Rock series are displayed in the main
            gallery space and available for purchase at the exhibition or via this website.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.block}>
          <h2>Public talk — Marcia van Zeller</h2>
          <p>
            Author and researcher Marcia van Zeller will give a public talk during the first week of the exhibition.
            Van Zeller spent years researching the Georgette wreck for her doctoral novel Cruel Capes (Curtin
            University, 2014) — the first long-form adult narrative about the incident, and the research foundation for
            the Captain Godfrey AI installation.
          </p>
          <p>The talk is free. Date and time to be confirmed.</p>
          <div className={styles.signup}>
            <p className={styles.signupLabel}>Notify me when the talk is scheduled</p>
            <EmailSignupForm source="visit_talk" buttonLabel="Notify me when the talk is scheduled" />
          </div>
        </FadeInSection>

        <FadeInSection className={styles.block}>
          <h2>Accessibility</h2>
          <p>
            The exhibition venue is wheelchair accessible. The Cubarama installation is accessible to wheelchair users
            — the projected environment requires no physical movement. The Drift installation uses a Kinect sensor and
            responds to a range of movement types; visitors with limited mobility are welcome and the system can be
            adjusted by gallery staff. Wall-hung prints and the Captain Godfrey AI installation are both fully
            accessible.
          </p>
          <p>
            If you have specific accessibility requirements, please contact us in advance and we will do our best to
            accommodate you.
          </p>
          <p>Contact: hello@margies.app</p>
        </FadeInSection>
      </div>
    </section>
  );
}
