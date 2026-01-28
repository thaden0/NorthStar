'use client';

import { FiMail, FiCornerUpLeft, FiX } from 'react-icons/fi';
import styles from './widgets.module.css';
import { EmailReadWidgetData } from './WidgetDrawer';

interface EmailReadWidgetProps {
  data: EmailReadWidgetData;
  onClose: () => void;
  onReply?: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function extractName(from: string): { name: string; email: string } {
  // Parse "Name <email@example.com>" format
  const match = from.match(/^(.+?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }
  // Just an email
  return { name: from.split('@')[0], email: from };
}

export default function EmailReadWidget({
  data,
  onClose,
  onReply,
}: EmailReadWidgetProps) {
  const { name, email } = extractName(data.from);

  return (
    <div className={styles.widgetCard}>
      {/* Header */}
      <div className={styles.widgetHeader}>
        <div className={styles.widgetHeaderLeft}>
          <div className={`${styles.widgetIcon} ${styles.widgetIconEmail}`}>
            <FiMail />
          </div>
          <div>
            <div className={styles.widgetTitle}>Email</div>
            <div className={styles.widgetSubtitle}>{formatDate(data.date)}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={styles.widgetContent}>
        <div className={styles.emailReadHeader}>
          <div className={styles.emailFrom}>
            <div className={styles.emailAvatar}>
              {getInitials(name)}
            </div>
            <div className={styles.emailFromInfo}>
              <div className={styles.emailFromName}>{name}</div>
              <div className={styles.emailFromEmail}>{email}</div>
            </div>
          </div>
        </div>

        <div className={styles.emailSubject}>{data.subject}</div>
        
        <div className={styles.emailBodyRead}>
          {data.isHtml ? (
            <div dangerouslySetInnerHTML={{ __html: data.body }} />
          ) : (
            data.body
          )}
        </div>
      </div>

      {/* Footer */}
      <div className={styles.widgetFooter}>
        <button 
          className={`${styles.widgetBtn} ${styles.widgetBtnSecondary}`}
          onClick={onClose}
        >
          <FiX size={12} />
          Close
        </button>
        {onReply && (
          <button 
            className={`${styles.widgetBtn} ${styles.widgetBtnPrimary}`}
            onClick={onReply}
          >
            <FiCornerUpLeft size={12} />
            Reply
          </button>
        )}
      </div>
    </div>
  );
}
