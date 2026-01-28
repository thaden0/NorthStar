'use client';

import { FiMail, FiX, FiSend } from 'react-icons/fi';
import styles from './widgets.module.css';
import { EmailSendWidgetData } from './WidgetDrawer';

interface EmailSendWidgetProps {
  data: EmailSendWidgetData;
  canCancel?: boolean;
  isProcessing?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function EmailSendWidget({
  data,
  canCancel = true,
  isProcessing = false,
  onCancel,
  onConfirm,
}: EmailSendWidgetProps) {
  return (
    <div className={styles.widgetCard}>
      {/* Header */}
      <div className={styles.widgetHeader}>
        <div className={styles.widgetHeaderLeft}>
          <div className={`${styles.widgetIcon} ${styles.widgetIconEmail}`}>
            <FiMail />
          </div>
          <div>
            <div className={styles.widgetTitle}>Compose Email</div>
            <div className={styles.widgetSubtitle}>Preview before sending</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={styles.widgetContent}>
        <div className={styles.emailField}>
          <span className={styles.emailFieldLabel}>To:</span>
          <span className={styles.emailFieldValue}>{data.to}</span>
        </div>
        
        {data.cc && (
          <div className={styles.emailField}>
            <span className={styles.emailFieldLabel}>Cc:</span>
            <span className={styles.emailFieldValue}>{data.cc}</span>
          </div>
        )}
        
        <div className={styles.emailField}>
          <span className={styles.emailFieldLabel}>Subject:</span>
          <span className={styles.emailFieldValue}>{data.subject}</span>
        </div>
        
        <div 
          className={`${styles.emailBody} ${data.isStreaming ? styles.emailBodyTyping : ''}`}
        >
          {data.body}
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
          className={`${styles.widgetBtn} ${styles.widgetBtnSuccess}`}
          onClick={onConfirm}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <div className={styles.widgetSpinner} />
          ) : (
            <>
              <FiSend size={12} />
              Send Email
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
