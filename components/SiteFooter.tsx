import Link from "next/link";

import { EmailSignupForm } from "./EmailSignupForm";
import styles from "./SiteFooter.module.css";

const links = [
  { href: "/story", label: "The Story" },
  { href: "/installations", label: "Installations" },
  { href: "/shop", label: "Photographs" },
  { href: "/visit", label: "Visit" },
  { href: "/shop", label: "Shop" },
];

type SiteFooterProps = {
  exhibitionTitle: string;
};

export function SiteFooter({ exhibitionTitle }: SiteFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.top}`}>
        <div>
          <p className={styles.title}>{exhibitionTitle}</p>
          <p className={styles.meta}>12-27 September 2026</p>
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
        </div>
      </div>

      <div className={`container ${styles.bottom}`}>
        <p>Photographs by John Bowskill · Margaret River Region Open Studios 2026</p>
      </div>
    </footer>
  );
}
