'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FiX, FiLayers } from 'react-icons/fi';
import styles from './widgets.module.css';
import EmailSendWidget from './EmailSendWidget';
import EmailReadWidget from './EmailReadWidget';
import CalendarWidget from './CalendarWidget';
import ContactsWidget from './ContactsWidget';

// Widget data types
export interface EmailSendWidgetData {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  isStreaming?: boolean;
}

export interface EmailReadWidgetData {
  id: string;
  from: string;
  fromEmail?: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  isHtml?: boolean;
}

export interface CalendarEventData {
  id?: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  description?: string;
}

export interface CalendarWidgetData {
  operation: 'create' | 'update' | 'delete';
  event: CalendarEventData;
  surroundingEvents?: CalendarEventData[];
}

export interface ContactData {
  resourceName?: string;
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  photoUrl?: string;
}

export interface ContactsWidgetData {
  operation: 'create' | 'update' | 'lookup';
  contact: ContactData;
  existingContact?: boolean;
}

export interface Widget {
  id: string;
  type: 'email_send' | 'email_read' | 'calendar' | 'contacts';
  data: EmailSendWidgetData | EmailReadWidgetData | CalendarWidgetData | ContactsWidgetData;
  canCancel?: boolean;
  isProcessing?: boolean;
}

interface WidgetDrawerProps {
  widgets: Widget[];
  onCancel: (widgetId: string) => void;
  onConfirm: (widgetId: string) => void;
  onClose: () => void;
}

const AUTO_CLOSE_DELAY = 5000; // 5 seconds

export default function WidgetDrawer({ widgets, onCancel, onConfirm, onClose }: WidgetDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [timerProgress, setTimerProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerStartRef = useRef<number>(0);
  const remainingTimeRef = useRef<number>(AUTO_CLOSE_DELAY);

  // Open drawer when widgets arrive
  useEffect(() => {
    if (widgets.length > 0) {
      setIsOpen(true);
      setIsClosing(false);
      startTimer();
    } else {
      handleClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgets.length]);

  // Start auto-close timer
  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerStartRef.current = Date.now();
    remainingTimeRef.current = AUTO_CLOSE_DELAY;
    setTimerProgress(100);
    setIsPaused(false);

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - timerStartRef.current;
      const remaining = Math.max(0, remainingTimeRef.current - elapsed);
      const progress = (remaining / AUTO_CLOSE_DELAY) * 100;
      
      setTimerProgress(progress);
      
      if (remaining <= 0) {
        handleClose();
      }
    }, 50);
  }, []);

  // Pause timer on interaction
  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPaused(true);
  }, []);

  // Close with animation
  const handleClose = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      onClose();
    }, 300);
  }, [onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Handle user interaction - pause timer
  const handleInteraction = () => {
    pauseTimer();
  };

  if (!isOpen && widgets.length === 0) {
    return null;
  }

  return (
    <div 
      className={`${styles.widgetDrawer} ${isOpen && !isClosing ? styles.widgetDrawerOpen : ''} ${isClosing ? styles.widgetDrawerClosing : ''}`}
      onMouseEnter={handleInteraction}
      onTouchStart={handleInteraction}
    >
      {/* Timer progress bar */}
      <div 
        className={`${styles.drawerTimer} ${isPaused ? styles.drawerTimerPaused : ''}`}
        style={{ width: `${timerProgress}%` }}
      />

      {/* Header */}
      <div className={styles.drawerHeader}>
        <div className={styles.drawerTitle}>
          <FiLayers />
          <span>Preview Actions ({widgets.length})</span>
        </div>
        <div className={styles.drawerActions}>
          <button className={styles.drawerCloseBtn} onClick={handleClose} title="Close drawer">
            <FiX size={14} />
          </button>
        </div>
      </div>

      {/* Widget Grid */}
      <div className={styles.widgetGrid}>
        {widgets.map((widget) => {
          switch (widget.type) {
            case 'email_send':
              return (
                <EmailSendWidget
                  key={widget.id}
                  data={widget.data as EmailSendWidgetData}
                  canCancel={widget.canCancel}
                  isProcessing={widget.isProcessing}
                  onCancel={() => onCancel(widget.id)}
                  onConfirm={() => onConfirm(widget.id)}
                />
              );
            case 'email_read':
              return (
                <EmailReadWidget
                  key={widget.id}
                  data={widget.data as EmailReadWidgetData}
                  onClose={() => onCancel(widget.id)}
                />
              );
            case 'calendar':
              return (
                <CalendarWidget
                  key={widget.id}
                  data={widget.data as CalendarWidgetData}
                  canCancel={widget.canCancel}
                  isProcessing={widget.isProcessing}
                  onCancel={() => onCancel(widget.id)}
                  onConfirm={() => onConfirm(widget.id)}
                />
              );
            case 'contacts':
              return (
                <ContactsWidget
                  key={widget.id}
                  data={widget.data as ContactsWidgetData}
                  canCancel={widget.canCancel}
                  isProcessing={widget.isProcessing}
                  onCancel={() => onCancel(widget.id)}
                  onConfirm={() => onConfirm(widget.id)}
                />
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}
