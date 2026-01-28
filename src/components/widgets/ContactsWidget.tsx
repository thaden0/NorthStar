'use client';

import Image from 'next/image';
import { FiUser, FiMail, FiPhone, FiBriefcase, FiX, FiCheck, FiUserPlus, FiEdit } from 'react-icons/fi';
import styles from './widgets.module.css';
import { ContactsWidgetData } from './WidgetDrawer';

interface ContactsWidgetProps {
  data: ContactsWidgetData;
  canCancel?: boolean;
  isProcessing?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function ContactsWidget({
  data,
  canCancel = true,
  isProcessing = false,
  onCancel,
  onConfirm,
}: ContactsWidgetProps) {
  const operationLabels = {
    create: 'Add Contact',
    update: 'Update Contact',
    lookup: 'Contact Found',
  };

  const operationIcons = {
    create: <FiUserPlus />,
    update: <FiEdit />,
    lookup: <FiUser />,
  };

  return (
    <div className={styles.widgetCard}>
      {/* Header */}
      <div className={styles.widgetHeader}>
        <div className={styles.widgetHeaderLeft}>
          <div className={`${styles.widgetIcon} ${styles.widgetIconContacts}`}>
            {operationIcons[data.operation]}
          </div>
          <div>
            <div className={styles.widgetTitle}>{operationLabels[data.operation]}</div>
            <div className={styles.widgetSubtitle}>Google Contacts</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={styles.widgetContent}>
        <div className={styles.contactCard}>
          {/* Avatar */}
          <div className={styles.contactAvatar}>
            {data.contact.photoUrl ? (
              <Image 
                src={data.contact.photoUrl} 
                alt={data.contact.name}
                width={48}
                height={48}
                className={styles.contactAvatarImage}
                unoptimized
              />
            ) : (
              getInitials(data.contact.name)
            )}
          </div>

          {/* Info */}
          <div className={styles.contactInfo}>
            <div className={styles.contactName}>{data.contact.name}</div>
            
            {data.contact.email && (
              <div className={styles.contactDetail}>
                <FiMail />
                <span>{data.contact.email}</span>
              </div>
            )}
            
            {data.contact.phone && (
              <div className={styles.contactDetail}>
                <FiPhone />
                <span>{data.contact.phone}</span>
              </div>
            )}
            
            {data.contact.organization && (
              <div className={styles.contactDetail}>
                <FiBriefcase />
                <span>{data.contact.organization}</span>
              </div>
            )}

            {data.existingContact && (
              <div className={styles.contactOperation}>
                Already in contacts
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className={styles.widgetFooter}>
        {data.operation === 'lookup' ? (
          <button 
            className={`${styles.widgetBtn} ${styles.widgetBtnSecondary}`}
            onClick={onCancel}
          >
            <FiX size={12} />
            Close
          </button>
        ) : (
          <>
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
                  <FiCheck size={12} />
                  {data.operation === 'create' ? 'Add' : 'Save'}
                </>
              )}
            </button>
          </>
        )}
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
