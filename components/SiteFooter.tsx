import Link from "next/link";

import { siteConfig } from "../lib/metadata";
import { EmailSignupForm } from "./EmailSignupForm";
import styles from "./SiteFooter.module.css";

const links = [
  { href: "/", label: "The Georgette 150th" },
  { href: "/story", label: "The Story" },
  { href: "/book", label: "Author’s Preface" },
  { href: "/about-the-photographer", label: "About the Photographer" },
  { href: "/installations", label: "Installations" },
  { href: "/shop", label: "Photographs" },
  { href: "/visit", label: "Visit" },
  { href: "/contact", label: "Contact" },
];

const socialLinks = [
  { href: siteConfig.social.facebook, label: "Facebook", icon: "facebook" as const },
  { href: siteConfig.social.instagram, label: "Instagram", icon: "instagram" as const },
];

function SocialIcon({ name }: { name: "facebook" | "instagram" }) {
  if (name === "facebook") {
    return (
      <svg className={styles.socialIcon} viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.91h2.4V9.86c0-2.37 1.4-3.68 3.56-3.68 1.03 0 2.11.18 2.11.18v2.33h-1.19c-1.17 0-1.54.73-1.54 1.48v1.78h2.62l-.42 2.91h-2.2V22c4.78-.75 8.44-4.91 8.44-9.93z"
        />
      </svg>
    );
  }

  return (
    <svg className={styles.socialIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5h-8.5zm8.75 1.75a1.125 1.125 0 1 1 0 2.25 1.125 1.125 0 0 1 0-2.25zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"
      />
    </svg>
  );
}

type SiteFooterProps = {
  exhibitionTitle: string;
};

export function SiteFooter({ exhibitionTitle }: SiteFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.top}`}>
        <div>
          <p className={styles.title}>{exhibitionTitle}</p>
          <p className={styles.meta}>SS Georgette 150th anniversary photographic exhibition</p>
          <p className={styles.meta}>12–27 September 2026 · Free admission</p>
          <p className={styles.meta}>20 Morris Rd, Forest Grove WA 6286</p>
          <p className={styles.meta}>Margaret River Region Open Studios</p>
        </div>

        <div>
          <p className={styles.columnTitle}>Navigate</p>
          <ul className={styles.links}>
            {links.map((link) => (
              <li key={link.href + link.label}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className={styles.columnTitle}>Stay informed</p>
          <EmailSignupForm source="footer" buttonLabel="Notify Me" compact />
          <p className={`${styles.columnTitle} ${styles.followTitle}`}>Follow</p>
          <ul className={styles.socialLinks}>
            {socialLinks.map((link) => (
              <li key={link.href}>
                <a
                  className={styles.socialLink}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <SocialIcon name={link.icon} />
                  <span>{link.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className={`container ${styles.collectionsBand}`}>
        <p>
          <span className={styles.collectionsLead}>Further collections.</span> Very limited edition work, reserved for
          collectors and invited guests.
        </p>
        <Link className={styles.collectionsLink} href="/collections/request">
          Request access
        </Link>
      </div>

      <div className={`container ${styles.bottom}`}>
        <p>
          Photographs by John Bowskill · Margaret River Region Open Studios 2026 ·{" "}
          <Link href="/">exhibition.margies.app</Link>
        </p>
      </div>
    </footer>
  );
}
