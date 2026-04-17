import {
  Activity,
  BarChart3,
  History,
  LayoutDashboard,
  UserRound,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../constants/app';
import styles from './Sidebar.module.css';

const iconMap = {
  dashboard: LayoutDashboard,
  actions: History,
  deviceUsage: BarChart3,
  sensors: Activity,
  profile: UserRound,
};

function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.key];

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
            >
              <Icon size={19} strokeWidth={1.9} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;
