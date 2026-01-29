'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EmailClient from './EmailClient';
import CalendarView from './CalendarView';
import ContactsView from './ContactsView';
import styles from './email.module.css';
import { FiMail, FiCalendar, FiUsers, FiChevronDown, FiPlus, FiRefreshCw, FiSettings } from 'react-icons/fi';

export const dynamic = 'force-dynamic';

interface ConnectedAccount {
  id: string;
  email: string;
  name?: string;
  isDefault?: boolean;
}

interface GoogleStatus {
  connected: boolean;
  email?: string;
}

type TabType = 'email' | 'calendar' | 'contacts';

export default function EmailPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('email');
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<ConnectedAccount | null>(null);
  const [showAccountSelector, setShowAccountSelector] = useState(false);

  // Fetch Google connection status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/google/status');
        if (response.ok) {
          const data = await response.json();
          setGoogleStatus(data);
          
          // If connected, create account entry (future: fetch all connected accounts)
          if (data.connected && data.email) {
            const account: ConnectedAccount = {
              id: 'primary',
              email: data.email,
              name: data.email.split('@')[0],
              isDefault: true,
            };
            setAccounts([account]);
            setSelectedAccount(account);
          }
        } else {
          setGoogleStatus({ connected: false });
        }
      } catch {
        setGoogleStatus({ connected: false });
      } finally {
        setIsLoading(false);
      }
    };
    fetchStatus();
  }, []);

  const handleConnectGoogle = async () => {
    try {
      const response = await fetch('/api/google/authorize');
      if (response.ok) {
        const data = await response.json();
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Failed to connect Google:', error);
    }
  };

  const handleAddAccount = () => {
    // For now, redirect to connect - future: support multiple accounts
    handleConnectGoogle();
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'email', label: 'Email', icon: <FiMail /> },
    { id: 'calendar', label: 'Calendar', icon: <FiCalendar /> },
    { id: 'contacts', label: 'Contacts', icon: <FiUsers /> },
  ];

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>Loading...</p>
      </div>
    );
  }

  if (!googleStatus?.connected) {
    return (
      <div className={styles.notConnectedContainer}>
        <div className={styles.notConnectedCard}>
          <div className={styles.notConnectedIcon}>
            <FiMail />
          </div>
          <h2>Connect Your Google Account</h2>
          <p>
            To access your emails, calendar, and contacts, please connect your Google account.
          </p>
          <button className={styles.connectButton} onClick={handleConnectGoogle}>
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Connect Google Account
          </button>
          <p className={styles.notConnectedNote}>
            We&apos;ll request access to Gmail, Google Calendar, and Google Contacts.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.emailPage}>
      {/* Header with Account Selector and Tabs */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          {/* Account Selector */}
          <div className={styles.accountSelector}>
            <button 
              className={styles.accountSelectorButton}
              onClick={() => setShowAccountSelector(!showAccountSelector)}
            >
              <div className={styles.accountAvatar}>
                {selectedAccount?.email.charAt(0).toUpperCase()}
              </div>
              <div className={styles.accountInfo}>
                <span className={styles.accountEmail}>{selectedAccount?.email}</span>
                <span className={styles.accountLabel}>Google Account</span>
              </div>
              <FiChevronDown className={`${styles.chevron} ${showAccountSelector ? styles.chevronOpen : ''}`} />
            </button>

            {showAccountSelector && (
              <div className={styles.accountDropdown}>
                <div className={styles.accountDropdownHeader}>
                  <span>Connected Accounts</span>
                </div>
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    className={`${styles.accountOption} ${selectedAccount?.id === account.id ? styles.accountOptionActive : ''}`}
                    onClick={() => {
                      setSelectedAccount(account);
                      setShowAccountSelector(false);
                    }}
                  >
                    <div className={styles.accountOptionAvatar}>
                      {account.email.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.accountOptionInfo}>
                      <span className={styles.accountOptionEmail}>{account.email}</span>
                      {account.isDefault && <span className={styles.defaultBadge}>Default</span>}
                    </div>
                  </button>
                ))}
                <div className={styles.accountDropdownDivider} />
                <button className={styles.addAccountButton} onClick={handleAddAccount}>
                  <FiPlus />
                  <span>Add Another Account</span>
                </button>
                <button 
                  className={styles.manageAccountsButton}
                  onClick={() => router.push('/dashboard/settings/profile')}
                >
                  <FiSettings />
                  <span>Manage Accounts</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className={styles.headerRight}>
          <button className={styles.headerAction} title="Sync">
            <FiRefreshCw />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className={styles.contentArea}>
        {activeTab === 'email' && <EmailClient accountEmail={selectedAccount?.email || ''} />}
        {activeTab === 'calendar' && <CalendarView accountEmail={selectedAccount?.email || ''} />}
        {activeTab === 'contacts' && <ContactsView accountEmail={selectedAccount?.email || ''} />}
      </div>
    </div>
  );
}
