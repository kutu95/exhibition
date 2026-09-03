"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReactNode, useState } from "react";

import styles from "../../app/admin/admin.module.css";

type NavLink = { href: string; label: string };
type NavSection = { label: string | null; links: NavLink[] };

const navSections: NavSection[] = [
  {
    label: null,
    links: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/on-site", label: "On-site sale" },
      { href: "/admin/fulfilment", label: "Fulfilment" },
    ],
  },
  {
    label: "Catalogue",
    links: [
      { href: "/admin/import-wizard", label: "Import Wizard" },
      { href: "/admin/register-photo", label: "Register Photo" },
      { href: "/admin/products", label: "Products" },
      { href: "/admin/wall-qr", label: "Wall QR labels" },
      { href: "/admin/print-profiles", label: "Print Templates" },
    ],
  },
  {
    label: "Email",
    links: [
      { href: "/admin/campaigns", label: "Campaigns" },
      { href: "/admin/email-designs", label: "Designs" },
      { href: "/admin/subscribers", label: "Subscribers" },
    ],
  },
  {
    label: null,
    links: [
      { href: "/admin/content", label: "Content" },
      { href: "/admin/content?tab=media", label: "Media" },
      { href: "/admin/talk-registrations", label: "Talk registrations" },
      { href: "/admin/vault", label: "Private collections" },
      { href: "/admin/events", label: "Events" },
      { href: "/admin/sales", label: "Sales" },
      { href: "/admin/favourites", label: "Favourites" },
    ],
  },
];

type AdminShellProps = {
  children: ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <div className={styles.adminRoot}>
      <div className={styles.topBar}>
        <span>Georgette Admin</span>
        <button className={styles.menuBtn} type="button" onClick={() => setMobileOpen((v) => !v)}>
          Menu
        </button>
      </div>

      <div className={styles.layout}>
        <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
          <p className={styles.brand}>Georgette Admin</p>
          <nav className={styles.nav}>
            {navSections.map((section, sectionIndex) => (
              <div key={section.label ?? `section-${sectionIndex}`} className={styles.navSection}>
                {section.label ? <p className={styles.navSectionLabel}>{section.label}</p> : null}
                {section.links.map((link) => {
                  const activeTab = searchParams.get("tab");
                  const isMediaLink = link.href.includes("tab=media");
                  const isContentLink = link.href === "/admin/content";
                  const pathOnly = link.href.split("?")[0];

                  let isActive =
                    pathname === link.href ||
                    (pathOnly !== "/admin" && pathname.startsWith(`${pathOnly}/`)) ||
                    pathname === pathOnly;

                  if (pathname === "/admin" && link.href !== "/admin") {
                    isActive = false;
                  }
                  if (pathname === "/admin/content" && isMediaLink) {
                    isActive = activeTab === "media";
                  }
                  if (pathname === "/admin/content" && isContentLink) {
                    isActive = activeTab !== "media";
                  }

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`${isActive ? styles.activeLink : ""} ${section.label ? styles.navSubLink : ""}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className={styles.sidebarBottom}>
            <a className={styles.siteLink} href="/" target="_blank" rel="noreferrer">
              View Site
            </a>
            <button className={styles.logoutBtn} type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </aside>

        <section className={styles.content}>{children}</section>
      </div>
    </div>
  );
}
