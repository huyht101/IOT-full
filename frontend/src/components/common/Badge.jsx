import styles from './Badge.module.css';

function Badge({ children, tone = 'neutral' }) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

export default Badge;
