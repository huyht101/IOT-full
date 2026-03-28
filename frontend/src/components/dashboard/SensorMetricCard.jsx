import styles from './SensorMetricCard.module.css';

function SensorMetricCard({ title, value, unit, subtitle, accent = 'indigo', icon: Icon }) {
  return (
    <article className={`${styles.card} ${styles[accent]}`}>
      <div className={styles.header}>
        <div>
          <p className={styles.title}>{title}</p>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {Icon ? (
          <span className={styles.iconWrap}>
            <Icon size={20} strokeWidth={1.9} />
          </span>
        ) : null}
      </div>
      <div className={styles.metricRow}>
        <span className={styles.value}>{value}</span>
        {unit ? <span className={styles.unit}>{unit}</span> : null}
      </div>
    </article>
  );
}

export default SensorMetricCard;
