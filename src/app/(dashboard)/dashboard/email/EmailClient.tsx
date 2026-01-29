'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './email.module.css';
import { 
  FiInbox, FiStar, FiSend, FiFile, FiTrash2, FiAlertCircle,
  FiSearch, FiRefreshCw, FiMoreVertical, FiPaperclip,
  FiChevronLeft, FiCornerUpLeft, FiCornerUpRight, FiArchive,
  FiEdit3, FiX, FiLoader
} from 'react-icons/fi';

interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromEmail: string;
  to: string;
  snippet: string;
  body?: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  hasAttachments?: boolean;
}

interface EmailClientProps {
  accountEmail: string;
}

type FolderType = 'inbox' | 'starred' | 'sent' | 'drafts' | 'trash' | 'spam';

// Component to intelligently render email body content (HTML, Markdown, or plain text)
function EmailBodyRenderer({ body, snippet }: { body?: string; snippet: string }) {
  const content = body || snippet;
  
  // Check if content looks like HTML
  const isHtml = useMemo(() => {
    if (!content) return false;
    return /<[a-z][\s\S]*>/i.test(content);
  }, [content]);
  
  // Check if content looks like Markdown (has common markdown patterns)
  const isMarkdown = useMemo(() => {
    if (!content || isHtml) return false;
    // Check for common markdown patterns
    const markdownPatterns = [
      /^#{1,6}\s/m,           // Headers
      /\*\*[^*]+\*\*/,        // Bold
      /\*[^*]+\*/,            // Italic
      /\[[^\]]+\]\([^)]+\)/,  // Links
      /^[-*+]\s/m,            // Unordered lists
      /^\d+\.\s/m,            // Ordered lists
      /^>\s/m,                // Blockquotes
      /`[^`]+`/,              // Inline code
      /```[\s\S]*```/,        // Code blocks
    ];
    return markdownPatterns.some(pattern => pattern.test(content));
  }, [content, isHtml]);
  
  if (!content) {
    return <p className={styles.emailBodyEmpty}>No content</p>;
  }
  
  if (isHtml) {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  }
  
  if (isMarkdown) {
    return (
      <div className={styles.markdownContent}>
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }
  
  // Plain text - preserve whitespace and line breaks
  return (
    <div className={styles.plainTextContent}>
      {content.split('\n').map((line, i) => (
        <p key={i}>{line || '\u00A0'}</p>
      ))}
    </div>
  );
}

const folders: { id: FolderType; label: string; icon: React.ReactNode; query?: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: <FiInbox />, query: 'in:inbox' },
  { id: 'starred', label: 'Starred', icon: <FiStar />, query: 'is:starred' },
  { id: 'sent', label: 'Sent', icon: <FiSend />, query: 'in:sent' },
  { id: 'drafts', label: 'Drafts', icon: <FiFile />, query: 'in:drafts' },
  { id: 'trash', label: 'Trash', icon: <FiTrash2 />, query: 'in:trash' },
  { id: 'spam', label: 'Spam', icon: <FiAlertCircle />, query: 'in:spam' },
];

// accountEmail is used for multi-account support (selecting which account to query)
export default function EmailClient({ accountEmail }: EmailClientProps) {
  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [composeData, setComposeData] = useState({
    to: '',
    subject: '',
    body: '',
    replyToMessageId: '',
  });
  const [isSending, setIsSending] = useState(false);
  const [folderCounts, setFolderCounts] = useState<Record<FolderType, number>>({
    inbox: 0, starred: 0, sent: 0, drafts: 0, trash: 0, spam: 0
  });

  const fetchEmails = useCallback(async (folder: FolderType) => {
    setIsLoading(true);
    try {
      const folderConfig = folders.find(f => f.id === folder);
      const query = searchQuery || folderConfig?.query || 'in:inbox';
      const accountParam = accountEmail ? `&accountEmail=${encodeURIComponent(accountEmail)}` : '';
      
      const response = await fetch(`/api/google/gmail/messages?query=${encodeURIComponent(query)}&maxResults=50${accountParam}`);
      if (response.ok) {
        const data = await response.json();
        setEmails(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, accountEmail]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const accountParam = accountEmail ? `?accountEmail=${encodeURIComponent(accountEmail)}` : '';
      const response = await fetch(`/api/google/gmail/unread-count${accountParam}`);
      if (response.ok) {
        const data = await response.json();
        setFolderCounts(prev => ({ ...prev, inbox: data.count || 0 }));
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  }, [accountEmail]);

  useEffect(() => {
    fetchEmails(activeFolder);
    fetchUnreadCount();
  }, [activeFolder, fetchEmails, fetchUnreadCount]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchEmails(activeFolder);
    await fetchUnreadCount();
    setIsRefreshing(false);
  };

  const handleSelectEmail = async (email: EmailMessage) => {
    setSelectedEmail(email);
    
    // Mark as read if unread
    if (!email.isRead) {
      try {
        const accountParam = accountEmail ? `?accountEmail=${encodeURIComponent(accountEmail)}` : '';
        await fetch(`/api/google/gmail/messages/${email.id}/read${accountParam}`, { method: 'PATCH' });
        setEmails(prev => prev.map(e => 
          e.id === email.id ? { ...e, isRead: true } : e
        ));
        // Decrement both unreadCount and folderCounts.inbox
        setFolderCounts(prev => ({ ...prev, inbox: Math.max(0, prev.inbox - 1) }));
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }

    // Fetch full email content
    try {
      const response = await fetch(`/api/google/gmail/messages/${email.id}`);
      if (response.ok) {
        const fullEmail = await response.json();
        setSelectedEmail(fullEmail);
      }
    } catch (error) {
      console.error('Failed to fetch email details:', error);
    }
  };

  const handleToggleStar = async (email: EmailMessage, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/google/gmail/messages/${email.id}/star`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred: !email.isStarred }),
      });
      setEmails(prev => prev.map(e => 
        e.id === email.id ? { ...e, isStarred: !e.isStarred } : e
      ));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(prev => prev ? { ...prev, isStarred: !prev.isStarred } : null);
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  const handleTrash = async (email: EmailMessage) => {
    try {
      await fetch(`/api/google/gmail/messages/${email.id}`, { method: 'DELETE' });
      setEmails(prev => prev.filter(e => e.id !== email.id));
      setSelectedEmail(null);
    } catch (error) {
      console.error('Failed to trash email:', error);
    }
  };

  const handleReply = (email: EmailMessage) => {
    setComposeData({
      to: email.fromEmail,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n---\nOn ${email.date}, ${email.from} wrote:\n${email.body || email.snippet}`,
      replyToMessageId: email.id,
    });
    setShowCompose(true);
  };

  const handleForward = (email: EmailMessage) => {
    setComposeData({
      to: '',
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n---\nForwarded message:\nFrom: ${email.from}\nDate: ${email.date}\nSubject: ${email.subject}\n\n${email.body || email.snippet}`,
      replyToMessageId: '',
    });
    setShowCompose(true);
  };

  const handleSendEmail = async () => {
    if (!composeData.to || !composeData.subject) return;
    
    setIsSending(true);
    try {
      const response = await fetch('/api/google/gmail/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composeData),
      });
      
      if (response.ok) {
        setShowCompose(false);
        setComposeData({ to: '', subject: '', body: '', replyToMessageId: '' });
        if (activeFolder === 'sent') {
          await fetchEmails('sent');
        }
      }
    } catch (error) {
      console.error('Failed to send email:', error);
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className={styles.emailClient}>
      {/* Sidebar - Folders */}
      <div className={styles.emailSidebar}>
        <button 
          className={styles.composeButton}
          onClick={() => {
            setComposeData({ to: '', subject: '', body: '', replyToMessageId: '' });
            setShowCompose(true);
          }}
        >
          <FiEdit3 />
          <span>Compose</span>
        </button>

        <nav className={styles.folderList}>
          {folders.map((folder) => (
            <button
              key={folder.id}
              className={`${styles.folderItem} ${activeFolder === folder.id ? styles.folderItemActive : ''}`}
              onClick={() => {
                setActiveFolder(folder.id);
                setSelectedEmail(null);
              }}
            >
              <span className={styles.folderIcon}>{folder.icon}</span>
              <span className={styles.folderLabel}>{folder.label}</span>
              {folderCounts[folder.id] > 0 && (
                <span className={styles.folderCount}>{folderCounts[folder.id]}</span>
              )}
            </button>
          ))}
        </nav>

        <div className={styles.storageInfo}>
          <div className={styles.storageBar}>
            <div className={styles.storageUsed} style={{ width: '35%' }} />
          </div>
          <span className={styles.storageText}>5.2 GB of 15 GB used</span>
        </div>
      </div>

      {/* Email List */}
      <div className={styles.emailListContainer}>
        <div className={styles.emailListHeader}>
          <div className={styles.searchContainer}>
            <FiSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchEmails(activeFolder)}
              className={styles.searchInput}
            />
          </div>
          <button 
            className={`${styles.refreshButton} ${isRefreshing ? styles.refreshing : ''}`}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <FiRefreshCw />
          </button>
        </div>

        <div className={styles.emailList}>
          {isLoading ? (
            <div className={styles.emailListLoading}>
              <div className={styles.spinner} />
              <span>Loading emails...</span>
            </div>
          ) : emails.length === 0 ? (
            <div className={styles.emailListEmpty}>
              <FiInbox className={styles.emptyIcon} />
              <span>No emails found</span>
            </div>
          ) : (
            emails.map((email) => (
              <div
                key={email.id}
                className={`${styles.emailItem} ${!email.isRead ? styles.emailItemUnread : ''} ${selectedEmail?.id === email.id ? styles.emailItemSelected : ''}`}
                onClick={() => handleSelectEmail(email)}
              >
                <button
                  className={`${styles.starButton} ${email.isStarred ? styles.starred : ''}`}
                  onClick={(e) => handleToggleStar(email, e)}
                >
                  <FiStar />
                </button>
                <div className={styles.emailItemContent}>
                  <div className={styles.emailItemHeader}>
                    <span className={styles.emailFrom}>{email.from}</span>
                    <span className={styles.emailDate}>{formatDate(email.date)}</span>
                  </div>
                  <div className={styles.emailSubject}>{email.subject || '(No subject)'}</div>
                  <div className={styles.emailSnippet}>{email.snippet}</div>
                </div>
                {email.hasAttachments && (
                  <FiPaperclip className={styles.attachmentIcon} />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Email Detail View */}
      {selectedEmail && (
        <div className={styles.emailDetail}>
          <div className={styles.emailDetailHeader}>
            <button 
              className={styles.backButton}
              onClick={() => setSelectedEmail(null)}
            >
              <FiChevronLeft />
            </button>
            <div className={styles.emailDetailActions}>
              <button 
                className={styles.actionButton}
                onClick={() => handleReply(selectedEmail)}
                title="Reply"
              >
                <FiCornerUpLeft />
              </button>
              <button 
                className={styles.actionButton}
                onClick={() => handleForward(selectedEmail)}
                title="Forward"
              >
                <FiCornerUpRight />
              </button>
              <button 
                className={styles.actionButton}
                title="Archive"
              >
                <FiArchive />
              </button>
              <button 
                className={`${styles.actionButton} ${styles.deleteButton}`}
                onClick={() => handleTrash(selectedEmail)}
                title="Delete"
              >
                <FiTrash2 />
              </button>
              <button className={styles.actionButton}>
                <FiMoreVertical />
              </button>
            </div>
          </div>

          <div className={styles.emailDetailContent}>
            <h2 className={styles.emailDetailSubject}>{selectedEmail.subject}</h2>
            
            <div className={styles.emailDetailMeta}>
              <div className={styles.emailDetailAvatar}>
                {selectedEmail.from.charAt(0).toUpperCase()}
              </div>
              <div className={styles.emailDetailSender}>
                <div className={styles.senderName}>{selectedEmail.from}</div>
                <div className={styles.senderEmail}>{selectedEmail.fromEmail}</div>
              </div>
              <div className={styles.emailDetailDate}>
                {new Date(selectedEmail.date).toLocaleString()}
              </div>
            </div>

            <div className={styles.emailDetailBody}>
              <EmailBodyRenderer body={selectedEmail.body} snippet={selectedEmail.snippet} />
            </div>
          </div>

          <div className={styles.emailDetailFooter}>
            <button 
              className={styles.replyButton}
              onClick={() => handleReply(selectedEmail)}
            >
              <FiCornerUpLeft />
              <span>Reply</span>
            </button>
            <button 
              className={styles.forwardButton}
              onClick={() => handleForward(selectedEmail)}
            >
              <FiCornerUpRight />
              <span>Forward</span>
            </button>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {showCompose && (
        <div className={styles.composeOverlay}>
          <div className={styles.composeModal}>
            <div className={styles.composeHeader}>
              <span>{composeData.replyToMessageId ? 'Reply' : 'New Message'}</span>
              <button 
                className={styles.composeClose}
                onClick={() => setShowCompose(false)}
              >
                <FiX />
              </button>
            </div>
            
            <div className={styles.composeForm}>
              <div className={styles.composeField}>
                <label>To</label>
                <input
                  type="email"
                  value={composeData.to}
                  onChange={(e) => setComposeData(prev => ({ ...prev, to: e.target.value }))}
                  placeholder="recipient@example.com"
                />
              </div>
              <div className={styles.composeField}>
                <label>Subject</label>
                <input
                  type="text"
                  value={composeData.subject}
                  onChange={(e) => setComposeData(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Email subject"
                />
              </div>
              <div className={styles.composeBody}>
                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData(prev => ({ ...prev, body: e.target.value }))}
                  placeholder="Write your message..."
                />
              </div>
            </div>

            <div className={styles.composeFooter}>
              <button 
                className={styles.sendButton}
                onClick={handleSendEmail}
                disabled={isSending || !composeData.to || !composeData.subject}
              >
                {isSending ? (
                  <>
                    <FiLoader className={styles.sendingSpinner} />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <FiSend />
                    <span>Send</span>
                  </>
                )}
              </button>
              <button 
                className={styles.discardButton}
                onClick={() => setShowCompose(false)}
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
