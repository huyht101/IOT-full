import styles from './SelectField.module.css';

function SelectField({ value, onChange, options, ariaLabel, disabled }) {
  return (
    <select
      className={styles.select}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value || 'empty'} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export default SelectField;
