'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  FiHome,
  FiCpu, 
  FiFolder, 
  FiUsers, 
  FiBriefcase, 
  FiSettings, 
  FiFileText,
  FiLogOut,
  FiChevronRight,
  FiSliders,
  FiClock,
  FiBell,
  FiDollarSign,
  FiCalendar
} from 'react-icons/fi';
import { logoutAction } from '@/server/auth/actions';
import type { NavItem, RoleName } from '@/types';
import styles from './Sidebar.module.css';

interface SidebarProps {
  user: {
    name: string;
    email: string;
    avatar: string | null;
    roles: string[];
  };
  isOpen: boolean;
  onClose: () => void;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'FiHome' },
  { label: 'AI Insights', href: '/dashboard/ai-insights', icon: 'FiCpu' },
  { label: 'Notifications', href: '/dashboard/notifications', icon: 'FiBell' },
  { label: 'Time Tracking', href: '/dashboard/time-tracking', icon: 'FiCalendar', roles: ['Super Admin'] },
  { label: 'Clients', href: '/dashboard/clients', icon: 'FiDollarSign', roles: ['Super Admin'] },
  { label: 'Files', href: '/dashboard/files', icon: 'FiFolder' },
  { label: 'Scheduled Tasks', href: '/dashboard/settings/scheduled-tasks', icon: 'FiClock' },
  { label: 'Users', href: '/dashboard/users', icon: 'FiUsers', roles: ['Super Admin'] },
  { label: 'Portfolio', href: '/dashboard/portfolio', icon: 'FiBriefcase', roles: ['Super Admin'] },
  { label: 'Site Settings', href: '/dashboard/settings', icon: 'FiSettings', roles: ['Super Admin'] },
  { label: 'AI Settings', href: '/dashboard/settings/ai', icon: 'FiSliders', roles: ['Super Admin'] },
  { label: 'Logs', href: '/dashboard/logs', icon: 'FiFileText', roles: ['Super Admin', 'Admin'] },
];

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FiHome,
  FiCpu,
  FiFolder,
  FiUsers,
  FiBriefcase,
  FiSettings,
  FiFileText,
  FiSliders,
  FiClock,
  FiBell,
  FiDollarSign,
  FiCalendar,
};

export default function Sidebar({ user, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const hasAccess = (item: NavItem): boolean => {
    if (!item.roles) return true;
    return item.roles.some((role) => user.roles.includes(role as RoleName));
  };

  const filteredNavItems = navItems.filter(hasAccess);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className={styles.overlay} onClick={onClose} />
      )}

      <motion.aside
        className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ''}`}
        initial={{ x: -280 }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {/* Logo */}
        <div className={styles.header}>
          <Link href="/dashboard" className={styles.logo}>
            <div className={styles.logoIcon}>
              <span>★</span>
            </div>
            <span className={styles.logoText}>North Star</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          <div className={styles.navSection}>
            <span className={styles.navSectionTitle}>Menu</span>
            <ul className={styles.navList}>
              {filteredNavItems.map((item) => {
                const Icon = iconMap[item.icon] || FiHome;
                const isActive = pathname === item.href || 
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                      onClick={onClose}
                    >
                      <Icon className={styles.navItemIcon} />
                      <span>{item.label}</span>
                      {isActive && (
                        <motion.div
                          className={styles.activeIndicator}
                          layoutId="activeIndicator"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* User Section */}
        <div className={styles.footer}>
          <Link href="/dashboard/settings/profile" className={styles.userCard}>
            <div className={styles.avatar}>
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} />
              ) : (
                <span>{getInitials(user.name)}</span>
              )}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userRole}>{user.roles[0] || 'User'}</span>
            </div>
            <FiChevronRight className={styles.chevron} />
          </Link>

          <form action={logoutAction}>
            <button type="submit" className={styles.logoutBtn}>
              <FiLogOut />
              <span>Logout</span>
            </button>
          </form>
        </div>
      </motion.aside>
    </>
  );
}
