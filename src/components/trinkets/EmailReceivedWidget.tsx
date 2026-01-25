'use client';

import { useState } from 'react';
import { FiMail, FiX, FiCornerUpLeft, FiClock, FiUser } from 'react-icons/fi';
import { EmailReceivedTrinket, useTrinketStore } from '@/stores/trinket-store';
import styles from './trinkets.module.css';

interface Props {
  trinket: EmailReceivedTrinket;
  onDismiss: () => void;
  onInteract: () => void;
}

export function EmailReceivedWidget({ trinket, onDismiss, onInteract }: Props) {
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { markInteracted } = useTrinketStore();

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handleReply = () => {
    setIsReplying(true);
    markInteracted(trinket.id);
    onInteract();
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    
    setIsSending(true);
    try {
      // TODO: Integrate with Google Service API
      const response = await fetch('/api/google/gmail/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: trinket.from,
          subject: `Re: ${trinket.subject}`,
          body: replyText,
          replyToMessageId: trinket.messageId,
        }),
      });

      if (response.ok) {
        setReplyText('');
        setIsReplying(false);
        // Could show success toast
      }
    } catch (error) {
      console.error('Failed to send reply:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className={styles.emailReceivedWidget} onClick={onInteract}>
      {/* Header */}
      <div className={styles.widgetHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBadge} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            <FiMail />
          </div>
          <div className={styles.headerInfo}>
            <span className={styles.widgetTitle}>New Email</span>
            <span className={styles.widgetSubtitle}>{trinket.subject}</span>
          </div>
        </div>
        <button className={styles.dismissBtn} onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
          <FiX />
        </button>
      </div>

      {/* Content */}
      <div className={styles.widgetBody}>
        <div className={styles.emailMeta}>
          <div className={styles.metaItem}>
            <FiUser />
            <span>From: {trinket.from}</span>
          </div>
          <div className={styles.metaItem}>
            <FiClock />
            <span>{formatDate(trinket.date)}</span>
          </div>
        </div>
        <div className={styles.emailSnippet}>
          {trinket.snippet}
        </div>

        {/* Reply Section */}
        {isReplying ? (
          <div className={styles.replySection}>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your reply..."
              className={styles.replyTextarea}
              autoFocus
            />
            <div className={styles.replyActions}>
              <button 
                onClick={handleSendReply}
                disabled={isSending || !replyText.trim()}
                className={styles.sendReplyBtn}
              >
                {isSending ? 'Sending...' : 'Send Reply'}
              </button>
              <button 
                onClick={() => setIsReplying(false)}
                className={styles.cancelReplyBtn}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={handleReply} className={styles.replyBtn}>
            <FiCornerUpLeft />
            Reply
          </button>
        )}
      </div>
    </div>
  );
}
