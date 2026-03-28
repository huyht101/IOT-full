import { Search } from 'lucide-react';
import styles from './SearchField.module.css';

function SearchField({ value, onChange, placeholder = 'Search...' }) {
  return (
    <label className={styles.wrapper}>
      <Search size={17} className={styles.icon} />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={styles.input}
      />
    </label>
  );
}

export default SearchField;
