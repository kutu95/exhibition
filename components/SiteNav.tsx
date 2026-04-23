"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import styles from "./SiteNav.module.css";

const navLinks = [
  { href: "/story", label: "The Story" },
  { href: "/installations", label: "Installations" },
  { href: "/shop", label: "Photographs" },
  { href: "/visit", label: "Visit" },
  { href: "/shop", label: "Shop" },
];

type SiteNavProps = {
  exhibitionTitle: string;
};

export function SiteNav({ exhibitionTitle }: SiteNavProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 80);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header className={`${styles.navRoot} ${isScrolled ? styles.scrolled : ""}`}>
      <nav className={`container ${styles.nav}`} aria-label="Primary">
        <Link className={styles.logo} href="/">
          {exhibitionTitle}
        </Link>

        <ul className={styles.desktopLinks}>
          {navLinks.map((link) => (
            <li key={link.href + link.label}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>

        <button
          className={styles.menuButton}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
      </nav>

      <div className={`${styles.mobileOverlay} ${mobileOpen ? styles.mobileOpen : ""}`}>
        <div className={styles.mobileLinks}>
          {navLinks.map((link, index) => (
            <Link
              key={link.href + link.label}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              style={{ transitionDelay: `${100 + index * 70}ms` }}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
