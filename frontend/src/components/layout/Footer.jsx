import { APP_NAME } from '../../constants/app';
import styles from './Footer.module.css';

function Footer() {
  return (
    <footer className={styles.footer}>
      <span>&copy; 2026 {APP_NAME}. All rights reserved.</span>
    </footer>
  );
}

export default Footer;
