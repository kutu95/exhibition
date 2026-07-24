"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { formatAUD } from "../lib/utils/currency";
import { useCart } from "./CartProvider";
import styles from "./SiteNav.module.css";

const navLinks = [
  { href: "/story", label: "The Story" },
  { href: "/about-the-photographer", label: "Photographer" },
  { href: "/installations#talk", label: "Author Talk" },
  { href: "/installations", label: "Installations" },
  { href: "/shop", label: "Photographs" },
  { href: "/visit", label: "Visit" },
];

type SiteNavProps = {
  exhibitionTitle: string;
};

export function SiteNav({ exhibitionTitle }: SiteNavProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cartPreviewOpen, setCartPreviewOpen] = useState(false);
  const { items, itemCount, subtotalAud } = useCart();

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

  const cartLabel = itemCount > 0 ? `Cart (${itemCount})` : "Cart";

  return (
    <header className={`${styles.navRoot} ${isScrolled ? styles.scrolled : ""}`}>
      <nav className={`container ${styles.nav}`} aria-label="Primary">
        <Link className={styles.logo} href="/">
          <Image
            src="/images/broken-propeller-mark.png"
            alt=""
            width={48}
            height={32}
            className={styles.logoMark}
            priority
          />
          <span>{exhibitionTitle}</span>
        </Link>

        <ul className={styles.desktopLinks}>
          {navLinks.map((link) => (
            <li key={link.href + link.label}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
          <li
            className={styles.cartItem}
            onMouseEnter={() => setCartPreviewOpen(true)}
            onMouseLeave={() => setCartPreviewOpen(false)}
            onFocus={() => setCartPreviewOpen(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setCartPreviewOpen(false);
              }
            }}
          >
            <Link href="/cart" className={styles.cartLink} aria-haspopup="dialog" aria-expanded={cartPreviewOpen}>
              {cartLabel}
            </Link>
            <div
              className={`${styles.cartPreview} ${cartPreviewOpen ? styles.cartPreviewOpen : ""}`}
              role="dialog"
              aria-label="Cart preview"
            >
              {items.length === 0 ? (
                <p className={styles.cartEmpty}>Your cart is empty.</p>
              ) : (
                <>
                  <ul className={styles.cartPreviewList}>
                    {items.map((item) => (
                      <li key={item.variant_id} className={styles.cartPreviewRow}>
                        <div className={styles.cartPreviewThumb}>
                          <Image
                            src={item.image_url}
                            alt={item.product_title}
                            fill
                            sizes="48px"
                            className={styles.cartPreviewImage}
                          />
                        </div>
                        <div className={styles.cartPreviewDetails}>
                          <p className={styles.cartPreviewTitle}>{item.product_title}</p>
                          <p className={styles.cartPreviewMeta}>
                            {item.variant_label} · Qty {item.quantity}
                          </p>
                        </div>
                        <p className={styles.cartPreviewPrice}>{formatAUD(item.price_aud * item.quantity)}</p>
                      </li>
                    ))}
                  </ul>
                  <div className={styles.cartPreviewFooter}>
                    <p>
                      <strong>Subtotal</strong>
                      <span>{formatAUD(subtotalAud)}</span>
                    </p>
                    <Link href="/cart" className={styles.cartPreviewCta} onClick={() => setCartPreviewOpen(false)}>
                      View cart
                    </Link>
                  </div>
                </>
              )}
            </div>
          </li>
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
          <Link
            href="/cart"
            onClick={() => setMobileOpen(false)}
            style={{ transitionDelay: `${100 + navLinks.length * 70}ms` }}
          >
            {cartLabel}
          </Link>
        </div>
      </div>
    </header>
  );
}
