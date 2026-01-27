'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMenu, FiUser, FiSettings, FiLogOut } from 'react-icons/fi';
import { logoutAction } from '@/server/auth/actions';
import { NotificationCenter } from '@/components/notifications';
import styles from './Header.module.css';

interface HeaderProps {
  user?: {
    name: string;
    email: string;
    avatar: string | null;
    roles: string[];
  } | null;
  onMenuClick?: () => void;
  isDashboard?: boolean;
}

export default function Header({ user, onMenuClick, isDashboard = false }: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className={`${styles.header} ${isDashboard ? styles.headerDashboard : ''}`}>
      <div className={styles.left}>
        {isDashboard && (
          <button className={styles.menuBtn} onClick={onMenuClick} aria-label="Toggle menu">
            <FiMenu />
          </button>
        )}
        
        {!isDashboard && (
          <Link href="/" className={styles.logo}>
            <div className={styles.logoIcon}>
              <span>★</span>
            </div>
            <span className={styles.logoText}>Leonard Waugh</span>
          </Link>
        )}
      </div>

      <div className={styles.right}>
        {user ? (
          <>
            {/* Notifications */}
            <NotificationCenter />

            {/* User dropdown */}
            <div className={styles.userDropdown} ref={dropdownRef}>
              <button
                className={styles.userBtn}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                aria-expanded={isDropdownOpen}
              >
                <div className={styles.avatar}>
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} />
                  ) : (
                    <span>{getInitials(user.name)}</span>
                  )}
                </div>
                <span className={styles.userName}>{user.name}</span>
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    className={styles.dropdown}
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className={styles.dropdownHeader}>
                      <span className={styles.dropdownName}>{user.name}</span>
                      <span className={styles.dropdownEmail}>{user.email}</span>
                    </div>

                    <div className={styles.dropdownDivider} />

                    <Link
                      href="/dashboard/settings/profile"
                      className={styles.dropdownItem}
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <FiUser />
                      <span>Profile Settings</span>
                    </Link>

                    <Link
                      href="/dashboard/settings"
                      className={styles.dropdownItem}
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <FiSettings />
                      <span>Settings</span>
                    </Link>

                    <div className={styles.dropdownDivider} />

                    <form action={logoutAction}>
                      <button type="submit" className={styles.dropdownItemDanger}>
                        <FiLogOut />
                        <span>Logout</span>
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <Link href="/login" className={styles.loginBtn}>
            Login to North Star
          </Link>
        )}
      </div>
    </header>
  );
}
