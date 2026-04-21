import styles from "./SectionDivider.module.css";

export function SectionDivider() {
  return (
    <div className={`container ${styles.wrap}`} aria-hidden>
      <span className={styles.line} />
      <svg className={styles.icon} viewBox="0 0 64 64" role="presentation">
        <path
          d="M8 36c8-7 16-7 24 0s16 7 24 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="32" cy="28" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className={styles.line} />
    </div>
  );
}
