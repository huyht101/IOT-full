import styles from './EmptyState.module.css';

function EmptyState({ title = 'No data found', message = 'There is nothing to show yet.' }) {
  return (
    <div className={styles.wrapper}>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
    </div>
  );
}

export default EmptyState;
