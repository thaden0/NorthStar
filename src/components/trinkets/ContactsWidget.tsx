'use client';

import { FiUsers, FiX, FiMail, FiPhone } from 'react-icons/fi';
import { ContactsTrinket } from '@/stores/trinket-store';
import styles from './trinkets.module.css';

interface Props {
  trinket: ContactsTrinket;
  onDismiss: () => void;
  onInteract: () => void;
}

export function ContactsWidget({ trinket, onDismiss, onInteract }: Props) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #ec4899, #be185d)',
      'linear-gradient(135deg, #06b6d4, #0891b2)',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className={styles.contactsWidget} onClick={onInteract}>
      {/* Header */}
      <div className={styles.widgetHeader}>
        <div className={styles.headerLeft}>
          <div className={styles.iconBadge} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <FiUsers />
          </div>
          <div className={styles.headerInfo}>
            <span className={styles.widgetTitle}>Contacts Found</span>
            <span className={styles.widgetSubtitle}>
              {trinket.query ? `"${trinket.query}"` : `${trinket.contacts.length} contacts`}
            </span>
          </div>
        </div>
        <button className={styles.dismissBtn} onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
          <FiX />
        </button>
      </div>

      {/* Content */}
      <div className={styles.widgetBody}>
        <div className={styles.contactsList}>
          {trinket.contacts.slice(0, 3).map((contact) => (
            <div key={contact.id} className={styles.contactItem}>
              {contact.photoUrl ? (
                <img 
                  src={contact.photoUrl} 
                  alt={contact.name}
                  className={styles.contactAvatar}
                />
              ) : (
                <div 
                  className={styles.contactAvatarPlaceholder}
                  style={{ background: getAvatarColor(contact.name) }}
                >
                  {getInitials(contact.name)}
                </div>
              )}
              
              <div className={styles.contactInfo}>
                <span className={styles.contactName}>{contact.name}</span>
                <div className={styles.contactDetails}>
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className={styles.contactLink}>
                      <FiMail />
                      <span>{contact.email}</span>
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className={styles.contactLink}>
                      <FiPhone />
                      <span>{contact.phone}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {trinket.contacts.length > 3 && (
            <div className={styles.moreContacts}>
              +{trinket.contacts.length - 3} more contacts
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
