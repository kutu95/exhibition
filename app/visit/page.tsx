import type { Metadata } from "next";

import { EmailSignupForm } from "../../components/EmailSignupForm";
import { FadeInSection } from "../../components/FadeInSection";
import styles from "./page.module.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3007";

export const metadata: Metadata = {
  title: "Visit · Exhibition Details",
  description: "Practical visit details for the SS Georgette Exhibition in Margaret River.",
  alternates: {
    canonical: "/visit",
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/visit`,
    title: "Visit · Exhibition Details | SS Georgette Exhibition",
    description: "Practical visit details for the SS Georgette Exhibition in Margaret River.",
    images: [{ url: "/images/placeholder-visit-og.jpg" }],
  },
};

export default function VisitPage() {
  return (
    <section className="section container">
      <div className={styles.grid}>
        <FadeInSection className={styles.block}>
          <p className="eyebrow">Plan Your Visit</p>
          <h1 className="heading-section">12-27 September 2026</h1>
          <p>
            Part of Margaret River Region Open Studios. Venue address will be confirmed by the
            photographer and published here ahead of opening.
          </p>
          <p>
            Opening hours (placeholder): 10:00am-5:00pm daily, with extended evening sessions on select
            Saturdays.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.block}>
          <h2>Getting There</h2>
          <p>
            The exhibition sits within the Margaret River region, approximately three hours south of
            Perth by car. Visitors coming from Perth can follow Forrest Highway and Bussell Highway
            south, then local signage to the Open Studios venue once exact address details are published.
          </p>
          <p>
            For local visitors, directional updates and parking notes will be posted in the week before
            opening to make arrival straightforward during busy Open Studios weekends.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.block}>
          <h2>The Truth About the Georgette</h2>
          <p>
            Marcia van Zeller&apos;s public talk explores the SS Georgette disaster through archival
            evidence, place-based photography, and narrative reconstruction. Marcia is the author of{" "}
            <em>Cruel Capes</em>, a historical novel developed from her PhD research at Curtin University.
          </p>
          <p>
            Scheduled for the week of 15 September 2026, free to attend, at the exhibition venue. Final
            date and session time will be confirmed in the program.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.block}>
          <h2>Accessibility</h2>
          <p>
            Wheelchair access details will be confirmed with venue specifications. The Kinect-based{" "}
            <em>Drift</em> installation is designed to accommodate varied movement ranges, with alternate
            interaction guidance available onsite.
          </p>
        </FadeInSection>

        <FadeInSection className={styles.block}>
          <h2>Get exhibition updates</h2>
          <div className={styles.signup}>
            <EmailSignupForm source="visit_page" buttonLabel="Get exhibition updates" />
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
