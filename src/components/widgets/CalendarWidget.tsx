'use client';

import { FiCalendar, FiClock, FiMapPin, FiX, FiCheck, FiTrash2 } from 'react-icons/fi';
import styles from './widgets.module.css';
import { CalendarWidgetData } from './WidgetDrawer';

interface CalendarWidgetProps {
  data: CalendarWidgetData;
  canCancel?: boolean;
  isProcessing?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(start);
  
  const dateStr = startDate.toLocaleDateString([], { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
  
  return `${dateStr}, ${formatTime(start)} - ${formatTime(end)}`;
}

function generateMiniCalendar(eventDate: Date): { day: number; isHeader?: boolean; isToday?: boolean; isEvent?: boolean }[] {
  const today = new Date();
  const year = eventDate.getFullYear();
  const month = eventDate.getMonth();
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  const days: { day: number; isHeader?: boolean; isToday?: boolean; isEvent?: boolean }[] = [];
  
  // Day headers
  const headers = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  headers.forEach((_, i) => {
    days.push({ day: i, isHeader: true });
  });
  
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    days.push({ day: 0 });
  }
  
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = today.getDate() === d && 
                    today.getMonth() === month && 
                    today.getFullYear() === year;
    const isEvent = eventDate.getDate() === d;
    
    days.push({ day: d, isToday, isEvent });
  }
  
  return days;
}

function getMonthName(date: Date): string {
  return date.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

export default function CalendarWidget({
  data,
  canCancel = true,
  isProcessing = false,
  onCancel,
  onConfirm,
}: CalendarWidgetProps) {
  const eventDate = new Date(data.event.start);
  const calendarDays = generateMiniCalendar(eventDate);
  
  const operationLabels = {
    create: 'New Event',
    update: 'Update Event',
    delete: 'Delete Event',
  };

  const operationColors = {
    create: '#22C55E',
    update: '#3B82F6',
    delete: '#EF4444',
  };

  return (
    <div className={styles.widgetCard}>
      {/* Header */}
      <div className={styles.widgetHeader}>
        <div className={styles.widgetHeaderLeft}>
          <div 
            className={`${styles.widgetIcon} ${styles.widgetIconCalendar}`}
            style={{ background: `linear-gradient(135deg, ${operationColors[data.operation]}, ${operationColors[data.operation]}CC)` }}
          >
            {data.operation === 'delete' ? <FiTrash2 /> : <FiCalendar />}
          </div>
          <div>
            <div className={styles.widgetTitle}>{operationLabels[data.operation]}</div>
            <div className={styles.widgetSubtitle}>Calendar Operation</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={styles.widgetContent}>
        <div className={styles.calendarWidget}>
          {/* Mini Calendar */}
          <div className={styles.miniCalendar}>
            <div className={styles.miniCalendarHeader}>
              {getMonthName(eventDate)}
            </div>
            <div className={styles.miniCalendarGrid}>
              {calendarDays.map((day, index) => (
                <div
                  key={index}
                  className={`
                    ${styles.miniCalendarDay}
                    ${day.isHeader ? styles.miniCalendarDayHeader : ''}
                    ${day.isToday ? styles.miniCalendarDayToday : ''}
                    ${day.isEvent ? styles.miniCalendarDaySelected : ''}
                  `}
                >
                  {day.isHeader 
                    ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.day]
                    : day.day > 0 ? day.day : ''
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Event Details */}
          <div className={styles.calendarEventDetails}>
            <div className={styles.calendarEventTitle}>{data.event.title}</div>
            
            <div className={styles.calendarEventMeta}>
              <div className={styles.calendarEventRow}>
                <FiClock size={12} />
                <span>{formatDateRange(data.event.start, data.event.end)}</span>
              </div>
              
              {data.event.location && (
                <div className={styles.calendarEventRow}>
                  <FiMapPin size={12} />
                  <span>{data.event.location}</span>
                </div>
              )}
            </div>

            {/* Surrounding Events */}
            {data.surroundingEvents && data.surroundingEvents.length > 0 && (
              <div className={styles.calendarSurrounding}>
                <div className={styles.calendarSurroundingTitle}>Other events that day</div>
                {data.surroundingEvents.slice(0, 3).map((event, index) => (
                  <div key={index} className={styles.calendarSurroundingEvent}>
                    <div className={styles.calendarSurroundingDot} />
                    <span>{formatTime(event.start)} - {event.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.widgetFooter}>
        {canCancel && (
          <button 
            className={`${styles.widgetBtn} ${styles.widgetBtnDanger}`}
            onClick={onCancel}
            disabled={isProcessing}
          >
            <FiX size={12} />
            Cancel
          </button>
        )}
        <button 
          className={`${styles.widgetBtn} ${data.operation === 'delete' ? styles.widgetBtnDanger : styles.widgetBtnSuccess}`}
          onClick={onConfirm}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <div className={styles.widgetSpinner} />
          ) : (
            <>
              {data.operation === 'delete' ? <FiTrash2 size={12} /> : <FiCheck size={12} />}
              {data.operation === 'create' ? 'Create' : data.operation === 'update' ? 'Update' : 'Delete'}
            </>
          )}
        </button>
      </div>

      {/* Loading Overlay */}
      {isProcessing && (
        <div className={styles.widgetLoading}>
          <div className={styles.widgetSpinner} />
        </div>
      )}
    </div>
  );
}
