import {
  Braces,
  Download,
  Figma,
  Github,
} from 'lucide-react';
import { useEffect } from 'react';
import { PROFILE_INFO, RESOURCE_LINKS } from '../constants/app';
import styles from './ProfilePage.module.css';

const iconMap = {
  pdf: Download,
  api: Braces,
  github: Github,
  figma: Figma,
};

function ProfilePage() {
  useEffect(() => {
    document.title = 'IoT Dashboard | Profile';
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>User Profile &amp; Resources</h1>

      <section className={styles.profileCard}>
        <div className={styles.avatarWrap}>
          <div className={styles.avatar}>HT</div>
          <span className={styles.onlineDot} />
        </div>
        <h2 className={styles.name}>{PROFILE_INFO.name}</h2>
        <p className={styles.role}>{PROFILE_INFO.role}</p>
        <p className={styles.email}>{PROFILE_INFO.email}</p>
        <p className={styles.bio}>{PROFILE_INFO.bio}</p>
      </section>

      <section className={styles.resourcesSection}>
        <h2 className={styles.sectionTitle}>Developer Resources</h2>
        <div className={styles.resourceGrid}>
          {RESOURCE_LINKS.map((resource) => {
            const Icon = iconMap[resource.id] || Download;

            return (
              <a
                key={resource.id}
                href={resource.href}
                target="_blank"
                rel="noreferrer"
                className={`${styles.resourceCard} ${resource.variant === 'primary' ? styles.primary : ''}`}
              >
                <Icon size={19} />
                <span>{resource.label}</span>
              </a>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default ProfilePage;
