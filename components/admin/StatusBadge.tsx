import styles from "./status-badge.module.css";

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const className = styles[status as keyof typeof styles] ?? styles.pending;
  return <span className={`${styles.badge} ${className}`}>{status}</span>;
}
