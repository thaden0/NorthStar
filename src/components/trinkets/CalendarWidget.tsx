'use client';

import { FiCalendar, FiX, FiClock, FiMapPin, FiCheck, FiBell } from 'react-icons/fi';
import { CalendarTrinket } from '@/stores/trinket-store';
import styles from './trinkets.module.css';

interface Props {
  trinket: CalendarTrinket;
  onDismiss: () => void;
  onInteract: () => void;
}

export function CalendarWidget({ trinket, onDismiss, onInteract }: Props) {
  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return {
        date: date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
        time: date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
      };
    } catch {
      return { date: dateStr, time: '' };
    }
  };

  const start = formatDateTime(trinket.start);
  const end = formatDateTime(trinket.end);
  const isSameDay = start.date === end.date;

  return (
    <div className={styles.calendarWidget} onClick={onInteract}>
      {/* Header */}
      <div className={styles.widgetHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBadge} style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}>
            {trinket.isNew ? <FiCalendar /> : <FiBell />}
          </div>
          <div className={styles.headerInfo}>
            <span className={styles.widgetTitle}>
              {trinket.isNew ? 'Event Created' : 'Upcoming Event'}
            </span>
            <span className={styles.widgetSubtitle}>{start.date}</span>
          </div>
        </div>
        <button className={styles.dismissBtn} onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
          <FiX />
        </button>
      </div>

      {/* Content */}
      <div className={styles.widgetBody}>
        <h3 className={styles.eventTitle}>{trinket.title}</h3>
        
        <div className={styles.eventDetails}>
          <div className={styles.detailItem}>
            <FiClock />
            <span>
              {start.time} - {end.time}
              {!isSameDay && ` (${end.date})`}
            </span>
          </div>
          
          {trinket.location && (
            <div className={styles.detailItem}>
              <FiMapPin />
              <span>{trinket.location}</span>
            </div>
          )}
        </div>

        {trinket.description && (
          <p className={styles.eventDescription}>
            {trinket.description.length > 100 
              ? `${trinket.description.substring(0, 100)}...` 
              : trinket.description}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className={styles.widgetFooter}>
        {trinket.isNew ? (
          <div className={styles.successBadge}>
            <FiCheck />
            <span>Added to calendar</span>
          </div>
        ) : (
          <div className={styles.reminderBadge}>
            <FiBell />
            <span>Starting soon</span>
          </div>
        )}
      </div>
    </div>
  );
}
