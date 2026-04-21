import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { AdminLoginForm } from "../../../components/admin/AdminLoginForm";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "../../../lib/admin-auth";
import styles from "./page.module.css";

export default async function AdminLoginPage() {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  const isAuthenticated = await verifyAdminSessionToken(token);

  if (isAuthenticated) {
    redirect("/admin");
  }

  return (
    <main className={styles.wrap}>
      <section className={styles.card}>
        <h1 className={styles.title}>Admin Login</h1>
        <AdminLoginForm />
      </section>
    </main>
  );
}
