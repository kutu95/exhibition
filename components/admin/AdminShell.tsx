"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ReactNode, useState } from "react";

import styles from "../../app/admin/admin.module.css";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/content?tab=media", label: "Media" },
  { href: "/admin/subscribers", label: "Subscribers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/sales", label: "Sales" },
];

type AdminShellProps = {
  children: ReactNode;
};

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

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
            {links.map((link) => {
              const activeTab = searchParams.get("tab");
              const isMediaLink = link.href.includes("tab=media");
              const isContentLink = link.href === "/admin/content";

              let isActive =
                pathname === link.href || pathname.startsWith(`${link.href}/`) || pathname === link.href.split("?")[0];

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
                  className={isActive ? styles.activeLink : ""}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className={styles.sidebarBottom}>
            <a className={styles.siteLink} href="https://exhibition.margies.app" target="_blank" rel="noreferrer">
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
