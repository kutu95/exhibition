import styles from "./admin.module.css";

export default function AdminLoading() {
  return (
    <div className={styles.statusPanel}>
      <h1>
        <span className={styles.loadingPulse} aria-hidden />
        Loading admin page
      </h1>
      <p className={styles.statusHint}>
        Fetching data from the server. If this takes more than a few seconds, the database may be
        unreachable or still starting up.
      </p>
    </div>
  );
}
