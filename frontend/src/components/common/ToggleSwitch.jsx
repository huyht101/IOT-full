import styles from './ToggleSwitch.module.css';

function ToggleSwitch({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      className={`${styles.switch} ${checked ? styles.checked : ''} ${disabled ? styles.disabled : ''}`}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
    >
      <span className={styles.track}>
        <span className={styles.thumb} />
      </span>
    </button>
  );
}

export default ToggleSwitch;
