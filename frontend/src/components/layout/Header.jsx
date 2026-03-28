import { APP_NAME } from '../../constants/app';
import styles from './Header.module.css';

function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logoMark} aria-hidden="true">
          <span className={styles.logoDiamond} />
        </span>
        <div>
          <div className={styles.title}>{APP_NAME}</div>
        </div>
      </div>
      <div className={styles.avatarWrap} aria-label="User avatar">
        <div className={styles.avatar}>HT</div>
        <span className={styles.onlineDot} />
      </div>
    </header>
  );
}

export default Header;
