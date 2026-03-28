import styles from './LoadingState.module.css';

function LoadingState({ label = 'Loading data...' }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.spinner} />
      <p className={styles.label}>{label}</p>
    </div>
  );
}

export default LoadingState;
