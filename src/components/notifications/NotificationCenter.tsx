'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiBell, FiCheck, FiCheckCircle, FiAlertCircle, FiClock, FiX } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import styles from './NotificationCenter.module.css';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications on mount and periodically
  useEffect(() => {
    fetchNotifications();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?limit=10');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const markAsRead = async (id: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      
      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAllAsRead = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'cron_result':
        return <FiCheckCircle className={styles.iconSuccess} />;
      case 'cron_error':
        return <FiAlertCircle className={styles.iconError} />;
      case 'system':
        return <FiBell className={styles.iconSystem} />;
      default:
        return <FiClock className={styles.iconDefault} />;
    }
  };

  return (
    <div className={styles.container} ref={dropdownRef}>
      <button 
        className={styles.bellButton} 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <FiBell />
        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className={styles.dropdown}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            <div className={styles.header}>
              <h3>Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  className={styles.markAllBtn}
                  onClick={markAllAsRead}
                  disabled={isLoading}
                >
                  <FiCheck />
                  Mark all read
                </button>
              )}
            </div>

            <div className={styles.list}>
              {notifications.length === 0 ? (
                <div className={styles.empty}>
                  <FiBell className={styles.emptyIcon} />
                  <p>No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`${styles.item} ${!notification.read ? styles.unread : ''}`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <div className={styles.itemIcon}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className={styles.itemContent}>
                      <h4>{notification.title}</h4>
                      <p>{notification.message.substring(0, 100)}...</p>
                      <span className={styles.time}>
                        {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    {!notification.read && (
                      <button 
                        className={styles.markReadBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                      >
                        <FiX />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className={styles.footer}>
              <Link 
                href="/dashboard/notifications" 
                className={styles.viewAllLink}
                onClick={() => setIsOpen(false)}
              >
                View all notifications
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
