'use client';

import { useEffect, useState, useRef } from 'react';
import { FiMail, FiX, FiCheck, FiLoader } from 'react-icons/fi';
import { EmailSendingTrinket, useTrinketStore } from '@/stores/trinket-store';
import styles from './trinkets.module.css';

interface Props {
  trinket: EmailSendingTrinket;
  onDismiss: () => void;
  onInteract: () => void;
}

export function EmailSendingWidget({ trinket, onDismiss, onInteract }: Props) {
  const { updateTrinket } = useTrinketStore();
  const [displayedBody, setDisplayedBody] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Typewriter effect for the email body
  useEffect(() => {
    if (trinket.status === 'typing') {
      let charIndex = 0;
      const fullBody = trinket.body;
      const charsPerTick = Math.max(1, Math.ceil(fullBody.length / 50)); // Adjust speed based on length
      
      intervalRef.current = setInterval(() => {
        charIndex += charsPerTick;
        const progress = Math.min(100, (charIndex / fullBody.length) * 100);
        
        setDisplayedBody(fullBody.substring(0, charIndex));
        updateTrinket(trinket.id, { progress });

        if (charIndex >= fullBody.length) {
          clearInterval(intervalRef.current!);
          // Transition to sending
          setTimeout(() => {
            updateTrinket(trinket.id, { status: 'sending' });
            // Simulate sending delay
            setTimeout(() => {
              updateTrinket(trinket.id, { status: 'sent' });
            }, 1500);
          }, 500);
        }
      }, 50);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setDisplayedBody(trinket.body);
    }
  }, [trinket.status]);

  const getStatusIcon = () => {
    switch (trinket.status) {
      case 'typing':
        return <span className={styles.typingCursor}>|</span>;
      case 'sending':
        return <FiLoader className={styles.spinningIcon} />;
      case 'sent':
        return <FiCheck className={styles.sentIcon} />;
      case 'error':
        return <FiX className={styles.errorIcon} />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (trinket.status) {
      case 'typing':
        return 'Composing email...';
      case 'sending':
        return 'Sending...';
      case 'sent':
        return 'Email sent!';
      case 'error':
        return 'Failed to send';
      default:
        return '';
    }
  };

  return (
    <div className={styles.emailSendingWidget} onClick={onInteract}>
      {/* Header */}
      <div className={styles.widgetHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBadge} style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
            <FiMail />
          </div>
          <div className={styles.headerInfo}>
            <span className={styles.widgetTitle}>AI Sending Email</span>
            <span className={styles.widgetSubtitle}>To: {trinket.to}</span>
          </div>
        </div>
        <button className={styles.dismissBtn} onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
          <FiX />
        </button>
      </div>

      {/* Content */}
      <div className={styles.widgetBody}>
        <div className={styles.emailSubject}>
          <strong>Subject:</strong> {trinket.subject}
        </div>
        <div className={styles.emailContent}>
          {displayedBody}
          {trinket.status === 'typing' && <span className={styles.typingCursor}>|</span>}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.widgetFooter}>
        <div className={styles.statusIndicator}>
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </div>
        {trinket.status === 'typing' && (
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${trinket.progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
