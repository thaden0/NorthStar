'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiBell, 
  FiCheck, 
  FiCheckCircle, 
  FiAlertCircle, 
  FiFilter,
  FiTrash2,
  FiRefreshCw,
  FiInbox,
  FiSettings,
  FiZap
} from 'react-icons/fi';
import { formatDistanceToNow, format } from 'date-fns';
import styles from './notifications.module.css';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

type FilterType = 'all' | 'unread' | 'read' | 'cron_result' | 'cron_error' | 'system';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/notifications?limit=100');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.data || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
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
        if (selectedNotification?.id === id) {
          setSelectedNotification(prev => prev ? { ...prev, read: true } : null);
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
        if (selectedNotification) {
          setSelectedNotification(prev => prev ? { ...prev, read: true } : null);
        }
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const wasUnread = notifications.find(n => n.id === id)?.read === false;
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (wasUnread) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
        if (selectedNotification?.id === id) {
          setSelectedNotification(null);
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'cron_result':
        return <FiCheckCircle className={styles.iconSuccess} />;
      case 'cron_error':
        return <FiAlertCircle className={styles.iconError} />;
      case 'system':
        return <FiSettings className={styles.iconSystem} />;
      case 'alert':
        return <FiAlertCircle className={styles.iconWarning} />;
      default:
        return <FiZap className={styles.iconDefault} />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'cron_result': return 'Task Completed';
      case 'cron_error': return 'Task Failed';
      case 'system': return 'System';
      case 'alert': return 'Alert';
      default: return 'Info';
    }
  };

  const filteredNotifications = notifications.filter(n => {
    switch (filter) {
      case 'unread': return !n.read;
      case 'read': return n.read;
      case 'cron_result':
      case 'cron_error':
      case 'system':
        return n.type === filter;
      default: return true;
    }
  });

  const filterCounts = {
    all: notifications.length,
    unread: notifications.filter(n => !n.read).length,
    read: notifications.filter(n => n.read).length,
    cron_result: notifications.filter(n => n.type === 'cron_result').length,
    cron_error: notifications.filter(n => n.type === 'cron_error').length,
    system: notifications.filter(n => n.type === 'system').length,
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <FiBell className={styles.headerIcon} />
          <div>
            <h1 className={styles.title}>Notifications</h1>
            <p className={styles.subtitle}>
              {unreadCount > 0 
                ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                : 'All caught up!'
              }
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button 
            className={styles.actionBtn}
            onClick={fetchNotifications}
            disabled={isLoading}
          >
            <FiRefreshCw className={isLoading ? styles.spinning : ''} />
            Refresh
          </button>
          {unreadCount > 0 && (
            <button 
              className={styles.actionBtnPrimary}
              onClick={markAllAsRead}
            >
              <FiCheck />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <FiFilter className={styles.filterIcon} />
          <span className={styles.filterLabel}>Filter:</span>
        </div>
        <div className={styles.filterTabs}>
          {[
            { key: 'all', label: 'All' },
            { key: 'unread', label: 'Unread' },
            { key: 'read', label: 'Read' },
            { key: 'cron_result', label: 'Completed' },
            { key: 'cron_error', label: 'Errors' },
            { key: 'system', label: 'System' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`${styles.filterTab} ${filter === tab.key ? styles.filterTabActive : ''}`}
              onClick={() => setFilter(tab.key as FilterType)}
            >
              {tab.label}
              {filterCounts[tab.key as FilterType] > 0 && (
                <span className={styles.filterCount}>
                  {filterCounts[tab.key as FilterType]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {/* Notifications List */}
        <div className={styles.listPanel}>
          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.loadingSpinner} />
              <p>Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className={styles.empty}>
              <FiInbox className={styles.emptyIcon} />
              <h3>No notifications</h3>
              <p>
                {filter === 'all' 
                  ? "You don't have any notifications yet"
                  : `No ${filter === 'unread' ? 'unread' : filter.replace('_', ' ')} notifications`
                }
              </p>
            </div>
          ) : (
            <div className={styles.list}>
              <AnimatePresence>
                {filteredNotifications.map((notification, index) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.03 }}
                    className={`${styles.listItem} ${!notification.read ? styles.unread : ''} ${selectedNotification?.id === notification.id ? styles.selected : ''}`}
                    onClick={() => {
                      setSelectedNotification(notification);
                      if (!notification.read) {
                        markAsRead(notification.id);
                      }
                    }}
                  >
                    <div className={styles.itemIcon}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className={styles.itemContent}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemType}>{getTypeLabel(notification.type)}</span>
                        <span className={styles.itemTime}>
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <h4 className={styles.itemTitle}>{notification.title}</h4>
                      <p className={styles.itemPreview}>
                        {notification.message.substring(0, 80)}
                        {notification.message.length > 80 ? '...' : ''}
                      </p>
                    </div>
                    {!notification.read && <div className={styles.unreadDot} />}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className={styles.detailPanel}>
          {selectedNotification ? (
            <motion.div
              key={selectedNotification.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={styles.detail}
            >
              <div className={styles.detailHeader}>
                <div className={styles.detailIcon}>
                  {getNotificationIcon(selectedNotification.type)}
                </div>
                <div className={styles.detailMeta}>
                  <span className={`${styles.detailBadge} ${styles[`badge_${selectedNotification.type}`]}`}>
                    {getTypeLabel(selectedNotification.type)}
                  </span>
                  <span className={styles.detailDate}>
                    {format(new Date(selectedNotification.createdAt), 'PPpp')}
                  </span>
                </div>
                <div className={styles.detailActions}>
                  {!selectedNotification.read && (
                    <button 
                      className={styles.detailBtn}
                      onClick={() => markAsRead(selectedNotification.id)}
                    >
                      <FiCheck />
                      Mark read
                    </button>
                  )}
                  <button 
                    className={`${styles.detailBtn} ${styles.detailBtnDanger}`}
                    onClick={() => deleteNotification(selectedNotification.id)}
                  >
                    <FiTrash2 />
                    Delete
                  </button>
                </div>
              </div>

              <h2 className={styles.detailTitle}>{selectedNotification.title}</h2>
              
              <div className={styles.detailMessage}>
                {selectedNotification.message.split('\n').map((line, i) => (
                  <p key={i}>{line || <br />}</p>
                ))}
              </div>

              {selectedNotification.data && Object.keys(selectedNotification.data).length > 0 && (
                <div className={styles.detailData}>
                  <h4>Additional Details</h4>
                  <pre>{JSON.stringify(selectedNotification.data, null, 2)}</pre>
                </div>
              )}
            </motion.div>
          ) : (
            <div className={styles.detailEmpty}>
              <FiBell className={styles.detailEmptyIcon} />
              <h3>Select a notification</h3>
              <p>Click on a notification to view its full content</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
