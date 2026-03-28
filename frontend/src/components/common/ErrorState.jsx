import styles from './ErrorState.module.css';

function ErrorState({ title = 'Something went wrong', message, actionLabel = 'Try again', onAction }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.icon} aria-hidden="true">!</div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      {onAction ? (
        <button type="button" className={styles.button} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export default ErrorState;
